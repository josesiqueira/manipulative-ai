from types import SimpleNamespace

from src.services.llm_models import get_default_model
from src.services.llm_providers.openai_provider import OpenAIProvider


class _FakeCompletions:
    def __init__(self):
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs.get("stream"):
            return iter(
                [
                    SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="Hei"))], usage=None),
                    # With include_usage the last chunk has no choices, only the usage.
                    SimpleNamespace(choices=[], usage=SimpleNamespace(total_tokens=5)),
                ]
            )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="Hei"))],
            usage=SimpleNamespace(total_tokens=3),
        )


def _provider():
    provider = OpenAIProvider("test-key")
    fake = _FakeCompletions()
    provider.client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return provider, fake


def test_gpt_6_astra_is_the_default_openai_model():
    assert get_default_model("openai") == "gpt-6-astra"


async def test_gpt_6_gets_no_temperature_and_gpt_5_4_keeps_it():
    provider, fake = _provider()
    messages = [{"role": "user", "content": "Hei"}]
    await provider.generate(messages, model="gpt-6-astra")
    list(provider.generate_streaming(messages, model="gpt-6-astra"))
    await provider.generate(messages, model="gpt-5.4")
    list(provider.generate_streaming(messages, model="gpt-5.4"))
    assert ["temperature" in c for c in fake.calls] == [False, False, True, True]
    assert fake.calls[2]["temperature"] == 0.1
    assert fake.calls[1]["stream_options"] == {"include_usage": True}
    assert provider.last_token_count == 5
