"""OpenAI LLM provider implementation."""
import asyncio
from typing import Iterator

import httpx
from openai import OpenAI

from .base import LLMProvider, split_system


# GPT-5.5 reasoning-family and GPT-6 models reject any temperature other
# than the default (1.0) with HTTP 400. Older GPT-5.x (5.4 family) and the GPT-4.x
# family accept arbitrary temperatures. We block-list the known-restrictive
# prefixes so everything else (including GPT-5.4, GPT-4.x, o-series) keeps
# receiving the configured temperature.
_TEMPERATURE_INCOMPATIBLE_PREFIXES = ("gpt-5.5", "gpt-6")

# GPT-6 request settings (measured on gpt-6-astra, 2026-10-21).
# reasoning_effort: the model accepts low, medium, high, xhigh (not none or
# minimal). The default behaves like medium; "low" keeps ordinary replies
# the same length and style, cuts the hidden reasoning to about 30 tokens and
# keeps "tell me in detail" replies under 3,000 tokens (default effort went
# past 4,000, beyond MAX_COMPLETION_TOKENS).
# service_tier "priority" (answered as "fast"): about 61 instead of 35 output
# tokens per second and a shorter wait for the first token, at twice the
# token price. Its prompt cache is separate from the default tier's, so the
# cache warm-up must use the same tier. Empty string = default tier.
_GPT6_PREFIXES = ("gpt-6",)
GPT6_REASONING_EFFORT = "low"
GPT6_SERVICE_TIER = "priority"

# One client (one HTTP connection pool) per API key for the whole process,
# instead of a new client and TLS connection per message. The read timeout
# stays under the API route's 180 s; the SDK's own retries (2, for
# connection errors, 429 and 5xx before any text arrives) stay on.
_TIMEOUT = httpx.Timeout(150.0, connect=10.0)
_CLIENTS: dict[str, OpenAI] = {}


def _client(api_key: str) -> OpenAI:
    client = _CLIENTS.get(api_key)
    if client is None:
        client = OpenAI(api_key=api_key, timeout=_TIMEOUT, max_retries=2)
        _CLIENTS[api_key] = client
    return client


def _one_system_message(messages: list[dict]) -> list[dict]:
    """The system parts joined into one system message, as the prompt has
    always been sent to OpenAI (its prompt cache needs no marker)."""
    system, rest = split_system(messages)
    return ([{"role": "system", "content": "".join(system)}] if system else []) + rest


def _supports_custom_temperature(model: str) -> bool:
    return not model.startswith(_TEMPERATURE_INCOMPATIBLE_PREFIXES)


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = _client(api_key)
        self.last_token_count = 0
        self.last_finish_reason: str | None = None
        self.last_service_tier: str | None = None

    def _kwargs(self, messages: list[dict], model: str, max_tokens: int, temperature: float) -> dict:
        kwargs: dict = {
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": _one_system_message(messages),
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if _supports_custom_temperature(model):
            kwargs["temperature"] = temperature
        if model.startswith(_GPT6_PREFIXES):
            kwargs["reasoning_effort"] = GPT6_REASONING_EFFORT
            if GPT6_SERVICE_TIER:
                kwargs["service_tier"] = GPT6_SERVICE_TIER
        return kwargs

    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
        # Streamed underneath and joined: without streaming, gpt-6-astra
        # returns EMPTY content whenever a reply reaches max_completion_tokens
        # (finish_reason "length"; measured 22 of 22), so repeating that call
        # only gives another empty reply. Streamed, the text arrives.
        text = await asyncio.to_thread(
            lambda: "".join(self.generate_streaming(messages, model, max_tokens, temperature))
        )
        return text, self.last_token_count

    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        stream = self.client.chat.completions.create(
            **self._kwargs(messages, model, max_tokens, temperature)
        )
        self.last_token_count = 0
        self.last_finish_reason = None
        self.last_service_tier = None
        for chunk in stream:
            self.last_service_tier = getattr(chunk, "service_tier", None) or self.last_service_tier
            # The last chunk carries the usage and no choices.
            if getattr(chunk, "usage", None) is not None:
                self.last_token_count = chunk.usage.total_tokens
            if chunk.choices:
                choice = chunk.choices[0]
                finish = getattr(choice, "finish_reason", None)
                if finish:
                    self.last_finish_reason = finish
                delta = getattr(choice, "delta", None)
                if delta is not None and delta.content:
                    yield delta.content
        if self.last_finish_reason != "stop":
            # "length": the reply hit the budget (cut mid-sentence);
            # None: the stream ended early (seen once in about 480 calls).
            print(f"LLM reply ended with finish_reason={self.last_finish_reason} "
                  f"tier={self.last_service_tier} tokens={self.last_token_count}")
        elif self.last_service_tier not in (None, "fast", "priority") and GPT6_SERVICE_TIER:
            # Fast mode can be downgraded to the default tier when traffic
            # ramps up too quickly; the reply is then slower.
            print(f"LLM reply served on tier {self.last_service_tier}")
