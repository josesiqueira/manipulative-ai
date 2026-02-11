"""
OpenAI LLM provider implementation.
"""

from typing import Iterator

from openai import OpenAI

from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    """
    OpenAI provider implementation.

    Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, and other OpenAI models.
    """

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
        """
        Generate a response using OpenAI API.

        Args:
            messages: List of message dicts. First message should be system.
            model: OpenAI model ID (e.g., 'gpt-4o', 'gpt-4-turbo').
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature.

        Returns:
            Tuple of (response_text, total_token_count)
        """
        # Convert to OpenAI format (system message is separate in our format)
        openai_messages = []
        for msg in messages:
            openai_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        response = self.client.chat.completions.create(
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
        """
        Generate a streaming response using OpenAI API.

        Yields text chunks as they are generated.
        """
        openai_messages = []
        for msg in messages:
            openai_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

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
