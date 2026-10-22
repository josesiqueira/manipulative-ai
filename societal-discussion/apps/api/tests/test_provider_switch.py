from types import SimpleNamespace

import anthropic
import httpx

from src.services import llm_client
from src.services.llm_client import _retryable, get_llm_provider
from src.services.llm_providers.anthropic_provider import AnthropicProvider, request_kwargs
from src.services.llm_providers.openai_provider import OpenAIProvider, _one_system_message
from src.services.prompt_builder import build_full_prompt, build_system_prompt

HEADERS = {"X-Admin-Password": "admin"}


class _FakeStream:
    def __init__(self, pieces, stop_reason, usage):
        self.text_stream = iter(pieces)
        self._final = SimpleNamespace(stop_reason=stop_reason, usage=usage)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return self._final


def _anthropic(stop_reason="end_turn"):
    provider = AnthropicProvider("test-key")
    calls: list[dict] = []
    usage = SimpleNamespace(
        input_tokens=20, output_tokens=7, cache_read_input_tokens=300_000, cache_creation_input_tokens=0
    )

    def stream(**kwargs):
        calls.append(kwargs)
        return _FakeStream(["Hei", " vain"], stop_reason, usage)

    provider.client = SimpleNamespace(messages=SimpleNamespace(stream=stream))
    return provider, calls


async def test_prompt_has_two_system_parts_that_join_to_the_system_prompt(db_session):
    messages = await build_full_prompt(db_session, "vihreat_antipopulist", [], "Hei", language="en")
    assert [m["role"] for m in messages] == ["system", "system", "user"]
    joined = messages[0]["content"] + messages[1]["content"]
    assert joined == build_system_prompt("vihreat_antipopulist", None, "en")
    # OpenAI still receives exactly one system message with the same text.
    sent = _one_system_message(messages)
    assert [m["role"] for m in sent] == ["system", "user"]
    assert sent[0]["content"] == joined


async def test_the_four_versions_of_a_party_share_the_cached_part(db_session):
    firsts = {
        (await build_full_prompt(db_session, f"sdp_{f}", [], "Hei", language=lang))[0]["content"]
        for f in ("populist", "antipopulist")
        for lang in ("fi", "en")
    }
    assert len(firsts) == 1


def test_anthropic_request_caches_the_first_system_part_and_sends_no_temperature():
    messages = [
        {"role": "system", "content": "OHJE JA OHJELMA"},
        {"role": "system", "content": "KEHYS JA KIELI"},
        {"role": "user", "content": "Hei"},
        {"role": "assistant", "content": "Moi"},
        {"role": "user", "content": "Mitä mieltä olet?"},
    ]
    kwargs = request_kwargs(messages, "claude-sonnet-5-5", 4096)
    assert kwargs["system"] == [
        {"type": "text", "text": "OHJE JA OHJELMA", "cache_control": {"type": "ephemeral", "ttl": "1h"}},
        {"type": "text", "text": "KEHYS JA KIELI"},
    ]
    assert [m["role"] for m in kwargs["messages"]] == ["user", "assistant", "user"]
    assert "temperature" not in kwargs
    assert kwargs["max_tokens"] == 4096


async def test_anthropic_reply_records_tokens_cache_and_finish():
    provider, calls = _anthropic()
    text, tokens = await provider.generate([{"role": "user", "content": "Hei"}], "claude-sonnet-5-5")
    assert text == "Hei vain"
    assert tokens == 20 + 7 + 300_000
    assert provider.last_cache_read == 300_000
    assert provider.last_finish_reason == "stop"
    assert calls[0]["model"] == "claude-sonnet-5-5"


def test_anthropic_reply_cut_at_max_tokens_is_marked_length():
    provider, _ = _anthropic(stop_reason="max_tokens")
    assert "".join(provider.generate_streaming([{"role": "user", "content": "Hei"}], "claude-sonnet-5-5"))
    assert provider.last_finish_reason == "length"


def _settings(monkeypatch, **values):
    for name, value in values.items():
        monkeypatch.setattr(llm_client.settings, name, value)


async def test_environment_picks_the_provider_and_model(db_session, monkeypatch):
    _settings(monkeypatch, openai_api_key="sk-openai", anthropic_api_key="sk-ant", llm_provider="openai", llm_model="")
    provider, model = await get_llm_provider(db_session)
    assert isinstance(provider, OpenAIProvider) and model == "gpt-6-astra"

    _settings(monkeypatch, llm_provider="anthropic")
    provider, model = await get_llm_provider(db_session)
    assert isinstance(provider, AnthropicProvider) and model == "claude-sonnet-5-5"

    _settings(monkeypatch, llm_model="claude-opus-5-5")
    assert (await get_llm_provider(db_session))[1] == "claude-opus-5-5"

    # A model of the other provider is ignored.
    _settings(monkeypatch, llm_model="gpt-5.4")
    assert (await get_llm_provider(db_session))[1] == "claude-sonnet-5-5"


async def test_admin_panel_switch_overrides_the_environment_with_environment_keys(client, monkeypatch):
    _settings(monkeypatch, openai_api_key="sk-openai-1234567890", anthropic_api_key="sk-ant-1234567890",
              llm_provider="openai", llm_model="")
    rows = (await client.get("/api/admin/llm/configs", headers=HEADERS)).json()
    assert {r["provider"]: (r["has_key"], r["is_active"]) for r in rows} == {
        "anthropic": (True, False),
        "openai": (True, True),
    }

    res = await client.post("/api/admin/llm/active", json={"provider": "anthropic"}, headers=HEADERS)
    assert res.status_code == 200 and res.json()["is_active"] is True
    rows = (await client.get("/api/admin/llm/configs", headers=HEADERS)).json()
    assert {r["provider"]: r["is_active"] for r in rows} == {"anthropic": True, "openai": False}

    res = await client.post("/api/admin/llm/active", json={"provider": "openai"}, headers=HEADERS)
    assert res.status_code == 200


async def test_admin_panel_refuses_a_provider_without_any_key(client, monkeypatch):
    _settings(monkeypatch, openai_api_key="sk-openai-1234567890", anthropic_api_key="")
    res = await client.post("/api/admin/llm/active", json={"provider": "anthropic"}, headers=HEADERS)
    assert res.status_code == 400


def test_anthropic_errors_that_clear_by_waiting_are_retried():
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    overloaded = anthropic.InternalServerError(
        "overloaded", response=httpx.Response(529, request=request), body=None
    )
    low_credit = anthropic.BadRequestError(
        "credit balance is too low", response=httpx.Response(400, request=request), body=None
    )
    assert _retryable(overloaded)
    assert _retryable(anthropic.APITimeoutError(request=request))
    assert not _retryable(low_credit)
