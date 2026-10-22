"""
LLM client for generating AI responses.

Uses the OpenAI API with GPT-6 Astra by default (llm_models.py). Party program grounding is handled
by prompt_builder.py which injects the full party text into the system prompt.
"""
import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass

import anthropic
import openai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Conversation, LLMConfig
from .encryption import decrypt_api_key
from .llm_models import AVAILABLE_MODELS, get_default_model, is_valid_model
from .llm_providers import AnthropicProvider, GPTLabProvider, LLMProvider, OpenAIProvider
from .prompt_builder import build_full_prompt

settings = get_settings()


async def get_active_llm_config(db: AsyncSession) -> LLMConfig | None:
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


def env_api_key(provider: str) -> str:
    """The provider's API key from the environment, or ""."""
    return {
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "gptlab": settings.gptlab_api_key,
    }.get(provider, "")


def _provider(provider: str, api_key: str) -> LLMProvider:
    if provider == "anthropic":
        return AnthropicProvider(api_key)
    if provider == "gptlab":
        return GPTLabProvider(api_key, settings.gptlab_base_url)
    return OpenAIProvider(api_key)


async def resolve_provider(db: AsyncSession) -> tuple[str, str, str] | None:
    """The provider that answers now: (provider, model, api key), or None.

    1. A provider made active in the admin panel, with its stored key or the
       key from the environment.
    2. LLM_PROVIDER and LLM_MODEL from the environment."""
    config = await get_active_llm_config(db)
    if config:
        api_key = (
            decrypt_api_key(config.encrypted_api_key)
            if config.encrypted_api_key
            else env_api_key(config.provider)
        )
        if api_key:
            return config.provider, config.selected_model or get_default_model(config.provider), api_key

    provider = settings.llm_provider if settings.llm_provider in AVAILABLE_MODELS else "openai"
    api_key = env_api_key(provider)
    if api_key:
        model = (
            settings.llm_model
            if is_valid_model(provider, settings.llm_model)
            else get_default_model(provider)
        )
        return provider, model, api_key
    return None


async def get_llm_provider(db: AsyncSession) -> tuple[LLMProvider, str]:
    chosen = await resolve_provider(db)
    if chosen is None:
        raise ValueError("No LLM API key configured.")
    provider, model, api_key = chosen
    return _provider(provider, api_key), model


# Room for the hidden reasoning of reasoning models as well as the reply:
# with 1024, GPT-6 Astra sometimes spent the whole budget reasoning and
# returned an empty reply.
MAX_COMPLETION_TOKENS = 4096


@dataclass
class PreparedReply:
    """Everything the model call needs, read from the database beforehand so
    the call itself holds no database connection."""

    provider: LLMProvider
    model: str
    messages: list[dict]


async def prepare_reply(
    db: AsyncSession,
    conversation: Conversation,
    user_message: str,
) -> PreparedReply:
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in conversation.messages
    ]
    messages = await build_full_prompt(
        db=db,
        party=conversation.assigned_party,
        conversation_history=conversation_history,
        current_message=user_message,
        language=getattr(conversation, "language", "fi"),
    )
    provider, model = await get_llm_provider(db)
    return PreparedReply(provider=provider, model=model, messages=messages)


class EmptyReplyError(RuntimeError):
    """The model returned no text twice in a row."""


def _retryable(exc: Exception) -> bool:
    if isinstance(exc, (anthropic.RateLimitError, anthropic.APITimeoutError,
                        anthropic.APIConnectionError, anthropic.InternalServerError)):
        # 429, timeouts, dropped connections, 5xx and 529 (overloaded). A
        # spent credit balance is a 400 on Anthropic and is not retried.
        return True
    if isinstance(exc, openai.RateLimitError):
        # credit_balance_exhausted / insufficient_quota is also a 429 but
        # never clears by waiting (seen 2026-10-21 at 18:25).
        body = getattr(exc, "body", None) or {}
        return body.get("type") != "insufficient_quota"
    return isinstance(exc, (openai.APITimeoutError, openai.APIConnectionError,
                            openai.InternalServerError))


async def generate_reply(prepared: PreparedReply) -> tuple[str, int, str]:
    """Call the model. Returns (response_text, token_count, model_name). An
    unusable reply (empty, or a stream cut without a finish reason) is never
    stored: the call is repeated once, then EmptyReplyError."""
    total_tokens = 0
    for attempt in range(2):
        try:
            response_text, token_count = await prepared.provider.generate(
                messages=prepared.messages,
                model=prepared.model,
                max_tokens=MAX_COMPLETION_TOKENS,
                temperature=0.1,
            )
        except Exception as e:  # noqa: BLE001
            if attempt == 1 or not _retryable(e):
                raise
            print(f"LLM call failed ({type(e).__name__}), retrying")
            continue
        total_tokens += token_count or 0
        finish = getattr(prepared.provider, "last_finish_reason", "stop")
        if response_text and response_text.strip() and finish is not None:
            return response_text.strip(), total_tokens, prepared.model
        print(f"LLM unusable reply from {prepared.model} (finish={finish}, "
              f"{token_count} tokens), retrying")
    raise EmptyReplyError(f"{prepared.model} returned no usable reply twice")


async def stream_reply(prepared: PreparedReply) -> AsyncIterator[str]:
    """Yield the reply in pieces as the model writes it. The provider's
    streaming call is blocking, so it runs in a thread and hands each piece
    to the event loop. Afterwards prepared.provider.last_token_count holds
    the call's token count when the provider reports it."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    done = object()

    def produce() -> None:
        try:
            for piece in prepared.provider.generate_streaming(
                messages=prepared.messages,
                model=prepared.model,
                max_tokens=MAX_COMPLETION_TOKENS,
                temperature=0.1,
            ):
                loop.call_soon_threadsafe(queue.put_nowait, piece)
        except Exception as exc:  # noqa: BLE001
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, done)

    worker = asyncio.create_task(asyncio.to_thread(produce))
    try:
        while True:
            item = await queue.get()
            if item is done:
                break
            if isinstance(item, Exception):
                raise item
            yield item
    finally:
        await asyncio.shield(worker)
