"""Anthropic LLM provider implementation."""
import asyncio
from typing import Iterator

import anthropic

from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = anthropic.Anthropic(api_key=api_key)

    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                anthropic_messages.append(
                    {"role": msg["role"], "content": msg["content"]}
                )

        response = await asyncio.to_thread(
            self.client.messages.create,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_content,
            messages=anthropic_messages,
        )

        response_text = response.content[0].text
        token_count = response.usage.input_tokens + response.usage.output_tokens
        return response_text, token_count

    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                anthropic_messages.append(
                    {"role": msg["role"], "content": msg["content"]}
                )

        with self.client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_content,
            messages=anthropic_messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
