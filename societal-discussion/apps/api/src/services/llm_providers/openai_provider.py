"""OpenAI LLM provider implementation."""
import asyncio
from typing import Iterator

from openai import OpenAI

from .base import LLMProvider


# GPT-5.5 reasoning-family models reject any temperature other than the
# default (1.0) with HTTP 400. Older GPT-5.x (5.4 family) and the GPT-4.x
# family accept arbitrary temperatures. We block-list the known-restrictive
# prefixes so everything else (including GPT-5.4, GPT-4.x, o-series) keeps
# receiving the configured temperature.
_TEMPERATURE_INCOMPATIBLE_PREFIXES = ("gpt-5.5",)


def _supports_custom_temperature(model: str) -> bool:
    return not model.startswith(_TEMPERATURE_INCOMPATIBLE_PREFIXES)


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = OpenAI(api_key=api_key)

    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
        openai_messages = [
            {"role": msg["role"], "content": msg["content"]} for msg in messages
        ]

        kwargs: dict = {
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": openai_messages,
        }
        if _supports_custom_temperature(model):
            kwargs["temperature"] = temperature

        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            **kwargs,
        )

        response_text = response.choices[0].message.content
        token_count = response.usage.total_tokens
        return response_text, token_count

    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        openai_messages = [
            {"role": msg["role"], "content": msg["content"]} for msg in messages
        ]

        kwargs: dict = {
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": openai_messages,
            "stream": True,
        }
        if _supports_custom_temperature(model):
            kwargs["temperature"] = temperature

        stream = self.client.chat.completions.create(**kwargs)

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
