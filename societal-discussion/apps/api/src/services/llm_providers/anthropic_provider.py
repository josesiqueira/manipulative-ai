"""
Anthropic LLM provider implementation.
"""

from typing import Iterator

import anthropic

from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    """
    Anthropic provider implementation.

    Supports Claude models (Sonnet, Opus, Haiku).
    """

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
        """
        Generate a response using Anthropic API.

        Args:
            messages: List of message dicts. First message should be system.
            model: Anthropic model ID (e.g., 'claude-sonnet-4-5-20250514').
            max_tokens: Maximum tokens in response.
            temperature: Sampling temperature.

        Returns:
            Tuple of (response_text, total_token_count)
        """
        # Extract system message and convert remaining messages
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        response = self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_content,
            messages=anthropic_messages,
        )

        response_text = response.content[0].text
        # Anthropic provides input and output tokens separately
        token_count = response.usage.input_tokens + response.usage.output_tokens

        return response_text, token_count

    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        """
        Generate a streaming response using Anthropic API.

        Yields text chunks as they are generated.
        """
        # Extract system message and convert remaining messages
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        with self.client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_content,
            messages=anthropic_messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
