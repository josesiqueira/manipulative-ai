"""
LLM client for generating AI responses.

Uses OpenAI API with GPT-5.4 by default. Party program grounding is handled
by prompt_builder.py which injects the full party text into the system prompt.
"""
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


async def generate_response(
    db: AsyncSession,
    conversation: Conversation,
    user_message: str,
) -> tuple[str, int]:
    """
    Generate an AI response for a conversation message.

    Returns (response_text, token_count).
    """
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

    response_text, token_count = await provider.generate(
        messages=messages,
        model=model,
        max_tokens=1024,
        temperature=0.1,
    )

    return response_text, token_count
