"""OpenAI LLM provider implementation."""
import asyncio
from typing import Iterator

from openai import OpenAI

from .base import LLMProvider


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

        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model=model,
            max_completion_tokens=max_tokens,
            temperature=temperature,
            messages=openai_messages,
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

        stream = self.client.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens,
            temperature=temperature,
            messages=openai_messages,
            stream=True,
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
