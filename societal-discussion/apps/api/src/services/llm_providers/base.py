"""
Base class for LLM providers.
"""

from abc import ABC, abstractmethod
from typing import Iterator


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.

    All LLM providers (OpenAI, Anthropic, etc.) must implement this interface.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
        """
        Generate a response from the LLM.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
                      First message should be system message.
            model: The model ID to use.
            max_tokens: Maximum tokens in the response.
            temperature: Sampling temperature (0.0 to 1.0).

        Returns:
            Tuple of (response_text, total_token_count)
        """
        pass

    @abstractmethod
    def generate_streaming(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> Iterator[str]:
        """
        Generate a streaming response from the LLM.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            model: The model ID to use.
            max_tokens: Maximum tokens in the response.
            temperature: Sampling temperature (0.0 to 1.0).

        Yields:
            Text chunks as they are generated.
        """
        pass
