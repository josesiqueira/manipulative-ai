"""
LLM client for generating AI responses.

Uses the OpenAI API with GPT-6 Astra by default (llm_models.py). Party program grounding is handled
by prompt_builder.py which injects the full party text into the system prompt.
"""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Conversation, LLMConfig
from .encryption import decrypt_api_key
from .llm_models import get_default_model
from .llm_providers import LLMProvider, OpenAIProvider, AnthropicProvider
from .prompt_builder import build_full_prompt

settings = get_settings()


async def get_active_llm_config(db: AsyncSession) -> LLMConfig | None:
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def get_llm_provider(db: AsyncSession) -> tuple[LLMProvider, str]:
    config = await get_active_llm_config(db)

    if config and config.encrypted_api_key:
        api_key = decrypt_api_key(config.encrypted_api_key)
        model = config.selected_model or get_default_model(config.provider)
        if config.provider == "anthropic":
            return AnthropicProvider(api_key), model
        else:
            return OpenAIProvider(api_key), model

    if settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key), get_default_model("openai")

    raise ValueError("No LLM API key configured.")


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


async def generate_reply(prepared: PreparedReply) -> tuple[str, int, str]:
    """Call the model. Returns (response_text, token_count, model_name). An
    empty reply is never stored: the call is repeated once, and a second empty
    reply raises EmptyReplyError."""
    total_tokens = 0
    for _attempt in range(2):
        response_text, token_count = await prepared.provider.generate(
            messages=prepared.messages,
            model=prepared.model,
            max_tokens=MAX_COMPLETION_TOKENS,
            temperature=0.1,
        )
        total_tokens += token_count or 0
        if response_text and response_text.strip():
            return response_text.strip(), total_tokens, prepared.model
        print(f"LLM empty reply from {prepared.model} ({token_count} tokens), retrying")
    raise EmptyReplyError(f"{prepared.model} returned an empty reply twice")
