"""OpenAI provider and retry, offline with a fake stream: GPT-6 request settings,
streamed underneath, retry after a cut stream or an empty reply, no retry
when the credits are exhausted."""
from types import SimpleNamespace as NS

import httpx
import openai
import pytest

from src.services.llm_client import EmptyReplyError, PreparedReply, generate_reply
from src.services.llm_providers.openai_provider import OpenAIProvider


def chunk(text=None, finish=None, usage=None, tier="fast"):
    choices = [] if usage else [NS(delta=NS(content=text), finish_reason=finish)]
    return NS(choices=choices, usage=usage, service_tier=tier)


class FakeCompletions:
    def __init__(self, scripts):
        self.scripts = list(scripts)
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        s = self.scripts.pop(0)
        if isinstance(s, Exception):
            raise s
        return iter(s)


def provider(scripts):
    p = OpenAIProvider("sk-test")
    fake = FakeCompletions(scripts)
    p.client = NS(chat=NS(completions=fake))
    return p, fake


OK = [chunk("Hei "), chunk("maailma.", "stop"), chunk(usage=NS(total_tokens=10))]
CUT = [chunk("Hei "), chunk("maa")]          # stream ended without finish reason
EMPTY = [chunk(None, "length"), chunk(usage=NS(total_tokens=1024))]


@pytest.mark.asyncio
async def test_gpt6_request_settings_and_join():
    p, fake = provider([OK])
    text, n, model = await generate_reply(PreparedReply(p, "gpt-6-astra", [{"role": "user", "content": "x"}]))
    assert text == "Hei maailma." and n == 10
    kw = fake.calls[0]
    assert kw["reasoning_effort"] == "low" and kw["service_tier"] == "priority"
    assert kw["stream"] is True and "temperature" not in kw and kw["max_completion_tokens"] == 4096


@pytest.mark.asyncio
async def test_retry_after_cut_stream_and_after_empty():
    p, fake = provider([CUT, OK])
    text, _, _ = await generate_reply(PreparedReply(p, "gpt-6-astra", []))
    assert text == "Hei maailma." and len(fake.calls) == 2
    p, fake = provider([EMPTY, EMPTY])
    with pytest.raises(EmptyReplyError):
        await generate_reply(PreparedReply(p, "gpt-6-astra", []))


@pytest.mark.asyncio
async def test_no_retry_when_credits_are_exhausted():
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    err = openai.RateLimitError("no credits", response=httpx.Response(429, request=req),
                                body={"type": "insufficient_quota", "code": "credit_balance_exhausted"})
    p, fake = provider([err, OK])
    with pytest.raises(openai.RateLimitError):
        await generate_reply(PreparedReply(p, "gpt-6-astra", []))
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_gpt54_keeps_temperature_and_no_gpt6_settings():
    p, fake = provider([OK])
    await generate_reply(PreparedReply(p, "gpt-5.4", []))
    kw = fake.calls[0]
    assert kw["temperature"] == 0.1 and "reasoning_effort" not in kw and "service_tier" not in kw
