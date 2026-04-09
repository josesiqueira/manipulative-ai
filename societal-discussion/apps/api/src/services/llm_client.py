"""
LLM client for generating AI responses using multiple LLM providers.

Supports OpenAI and Anthropic with configurable API keys stored in the database.
Falls back to OPENAI_API_KEY environment variable if no database configuration exists.

Few-shot example selection and caching are handled at chat creation time
(see chats.py router + example_selector.py).  This module reads the cached
turns from chat.few_shot_examples and passes them directly to build_full_prompt,
avoiding any per-message DB round-trips for example selection.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Chat, LLMConfig
from .encryption import decrypt_api_key
from .llm_models import get_default_model
from .llm_providers import LLMProvider, OpenAIProvider, AnthropicProvider
from .prompt_builder import build_full_prompt, get_persona_text_from_db

settings = get_settings()


async def get_active_llm_config(db: AsyncSession) -> LLMConfig | None:
    """
    Get the currently active LLM configuration from the database.

    Returns:
        The active LLMConfig, or None if no active configuration exists.
    """
    result = await db.execute(
        select(LLMConfig).where(LLMConfig.is_active == True)
    )
    return result.scalar_one_or_none()


async def get_llm_provider(db: AsyncSession) -> tuple[LLMProvider, str]:
    """
    Get the appropriate LLM provider based on database configuration.

    Falls back to OpenAI with env var API key if no database config exists.

    Args:
        db: Database session

    Returns:
        Tuple of (provider instance, model ID to use)

    Raises:
        ValueError: If no API key is configured anywhere
    """
    # Try to get active config from database
    config = await get_active_llm_config(db)

    if config and config.encrypted_api_key:
        # Use database configuration
        api_key = decrypt_api_key(config.encrypted_api_key)
        model = config.selected_model or get_default_model(config.provider)

        if config.provider == "anthropic":
            return AnthropicProvider(api_key), model
        else:
            # Default to OpenAI
            return OpenAIProvider(api_key), model

    # Fall back to environment variable (OpenAI only)
    if settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key), get_default_model("openai")

    raise ValueError(
        "No LLM API key configured. Please set OPENAI_API_KEY environment variable "
        "or configure an API key in the admin panel."
    )


async def generate_response(
    db: AsyncSession,
    chat: Chat,
    user_message: str,
) -> tuple[str, list[int], int]:
    """
    Generate an AI response for a chat message.

    Uses the configured LLM provider from the database, or falls back to
    OpenAI with the OPENAI_API_KEY environment variable.

    Few-shot turns are read from chat.few_shot_examples, which is populated
    at chat creation time (see chats.py router).  This avoids a DB query for
    examples on every message and keeps the synthetic prior conversation
    stable across all turns of a session.

    Args:
        db: Database session
        chat: Chat object with political block, topic, history, and cached
              few_shot_examples JSON ({"turns": [...], "example_ids": [...]})
        user_message: The user's message to respond to

    Returns:
        Tuple of (response_text, example_ids_used, token_count)
    """
    # Read cached few-shot data set at chat creation time.
    # Gracefully handles chats created before caching was introduced (empty dict).
    few_shot_data = chat.few_shot_examples or {}
    few_shot_turns = few_shot_data.get("turns", [])
    example_ids = few_shot_data.get("example_ids", [])

    # Build conversation history from existing messages
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in chat.messages
    ]

    # Load persona override from DB (returns None if no config exists,
    # in which case the hardcoded default is used).
    persona_override = await get_persona_text_from_db(
        db, chat.political_block, chat.language
    )

    # Build the full prompt.
    # Order: system prompt → synthetic few-shot turns → real history → current message.
    messages = build_full_prompt(
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
        few_shot_turns=few_shot_turns,
        persona_override=persona_override,
    )

    # Get provider and model
    provider, model = await get_llm_provider(db)

    # Generate response using the provider abstraction
    response_text, token_count = await provider.generate(
        messages=messages,
        model=model,
        max_tokens=1024,
        temperature=0.1,
    )

    return response_text, example_ids, token_count


async def generate_response_streaming(
    db: AsyncSession,
    chat: Chat,
    user_message: str,
):
    """
    Generate an AI response with streaming (for future real-time UI).

    Uses the configured LLM provider from the database, or falls back to
    OpenAI with the OPENAI_API_KEY environment variable.

    Few-shot turns are read from chat.few_shot_examples, identical to the
    non-streaming path, so both code paths present the model with the same
    synthetic prior conversation.

    Yields:
        str chunks of the response text as they arrive, followed by a final
        dict {"type": "metadata", "example_ids": [...], "token_count": int}.
    """
    # Read cached few-shot data set at chat creation time.
    few_shot_data = chat.few_shot_examples or {}
    few_shot_turns = few_shot_data.get("turns", [])
    example_ids = few_shot_data.get("example_ids", [])

    # Build conversation history from existing messages
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in chat.messages
    ]

    # Load persona override from DB.
    persona_override = await get_persona_text_from_db(
        db, chat.political_block, chat.language
    )

    # Build the full prompt.
    messages = build_full_prompt(
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
        few_shot_turns=few_shot_turns,
        persona_override=persona_override,
    )

    # Get provider and model
    provider, model = await get_llm_provider(db)

    # Stream response using the provider abstraction
    full_text = ""
    for chunk in provider.generate_streaming(
        messages=messages,
        model=model,
        max_tokens=1024,
        temperature=0.1,
    ):
        full_text += chunk
        yield chunk

    # Return metadata after streaming completes
    yield {
        "type": "metadata",
        "example_ids": example_ids,
        "token_count": len(full_text.split()) * 2,  # Rough estimate for streaming
    }
