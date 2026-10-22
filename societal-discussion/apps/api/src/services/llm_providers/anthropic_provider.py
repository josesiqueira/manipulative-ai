"""Anthropic LLM provider implementation."""
import asyncio
from typing import Iterator

import anthropic
import httpx

from .base import LLMProvider, split_system

# The first system part (instruction and full party program, the same for
# the four versions of a party) is written to Anthropic's prompt cache for
# one hour; later replies read it at a small part of the input price. The
# cache entry is refreshed each time it is read.
CACHE_TTL = "1h"

# One client (one HTTP connection pool) per API key, as for OpenAI. The read
# timeout stays under the API route's 180 s; the SDK's own retries (2, for
# connection errors, 429, 529 and 5xx before any text arrives) stay on.
_TIMEOUT = httpx.Timeout(150.0, connect=10.0)
_CLIENTS: dict[str, anthropic.Anthropic] = {}

# Anthropic's stop reasons in the terms generate_reply uses: "stop" for a
# finished reply, "length" for one cut at max_tokens.
_FINISH = {"end_turn": "stop", "stop_sequence": "stop", "max_tokens": "length"}

# USD per million tokens (input, 1 h cache write, cache read, output), from
# Anthropic's pricing page on 22 October 2026, for the usage log line only.
# Haiku 5.5 prompts over 100K tokens cost more; the line shows its lower price.
_PRICES = {
    "claude-sonnet-5-5": (2.0, 4.0, 0.10, 10.0),
    "claude-opus-5-5": (4.0, 8.0, 0.20, 20.0),
    "claude-haiku-5-5": (0.10, 0.20, 0.01, 0.50),
}


def usage_line(model: str, input_tokens: int, cache_write: int, cache_read: int, output: int) -> str:
    """One log line per reply: token counts and their price, never any text."""
    line = (f"LLM usage model={model} input={input_tokens} cache_write={cache_write} "
            f"cache_read={cache_read} output={output}")
    prices = _PRICES.get(model)
    if prices:
        usd = (input_tokens * prices[0] + cache_write * prices[1]
               + cache_read * prices[2] + output * prices[3]) / 1e6
        line += f" usd={usd:.4f}"
    return line


def _client(api_key: str) -> anthropic.Anthropic:
    client = _CLIENTS.get(api_key)
    if client is None:
        client = anthropic.Anthropic(api_key=api_key, timeout=_TIMEOUT, max_retries=2)
        _CLIENTS[api_key] = client
    return client


def request_kwargs(messages: list[dict], model: str, max_tokens: int) -> dict:
    """The Messages API request. No temperature is sent: the model's default
    is used, as for GPT-6."""
    system, rest = split_system(messages)
    blocks = [{"type": "text", "text": text} for text in system if text]
    if blocks:
        blocks[0]["cache_control"] = {"type": "ephemeral", "ttl": CACHE_TTL}
    return {"model": model, "max_tokens": max_tokens, "system": blocks, "messages": rest}


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = _client(api_key)
        self.last_token_count = 0
        self.last_finish_reason: str | None = None
        self.last_cache_read = 0
        self.last_cache_write = 0

    async def generate(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> tuple[str, int]:
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
        self.last_token_count = 0
        self.last_finish_reason = None
        self.last_cache_read = 0
        self.last_cache_write = 0
        with self.client.messages.stream(**request_kwargs(messages, model, max_tokens)) as stream:
            for text in stream.text_stream:
                yield text
            final = stream.get_final_message()
        usage = final.usage
        self.last_cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        self.last_cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
        self.last_token_count = (
            (usage.input_tokens or 0) + self.last_cache_read + self.last_cache_write
            + (usage.output_tokens or 0)
        )
        self.last_finish_reason = _FINISH.get(final.stop_reason, final.stop_reason)
        print(usage_line(model, usage.input_tokens or 0, self.last_cache_write,
                         self.last_cache_read, usage.output_tokens or 0), flush=True)
        if self.last_finish_reason != "stop":
            print(f"LLM reply ended with stop_reason={final.stop_reason} "
                  f"tokens={self.last_token_count}")
