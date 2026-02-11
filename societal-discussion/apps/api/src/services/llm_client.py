"""
LLM client for generating AI responses using multiple LLM providers.

Supports OpenAI and Anthropic with configurable API keys stored in the database.
Falls back to OPENAI_API_KEY environment variable if no database configuration exists.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Chat, LLMConfig
from .encryption import decrypt_api_key
from .example_selector import get_examples_for_prompt
from .llm_models import get_default_model
from .llm_providers import LLMProvider, OpenAIProvider, AnthropicProvider
from .prompt_builder import build_full_prompt

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

    Args:
        db: Database session
        chat: Chat object with political block, topic, and history
        user_message: The user's message to respond to

    Returns:
        Tuple of (response_text, example_ids_used, token_count)
    """
    # Get few-shot examples from database
    examples, example_ids = await get_examples_for_prompt(
        db=db,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        language=chat.language,
        n=3,
    )

    # Build conversation history from existing messages
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in chat.messages
    ]

    # Build the full prompt
    messages = await build_full_prompt(
        db=db,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        examples=examples,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
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

    Yields chunks of the response text as they're generated.
    """
    # Get few-shot examples from database
    examples, example_ids = await get_examples_for_prompt(
        db=db,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        language=chat.language,
        n=3,
    )

    # Build conversation history from existing messages
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in chat.messages
    ]

    # Build the full prompt
    messages = await build_full_prompt(
        db=db,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        examples=examples,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
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
