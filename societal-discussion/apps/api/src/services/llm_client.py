"""
LLM client for generating AI responses using Claude API.
"""

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..models import Chat
from .example_selector import get_examples_for_prompt
from .prompt_builder import build_full_prompt

settings = get_settings()


async def generate_response(
    db: AsyncSession,
    chat: Chat,
    user_message: str,
) -> tuple[str, list[int], int]:
    """
    Generate an AI response for a chat message.

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
    messages = build_full_prompt(
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        examples=examples,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
    )

    # Call Claude API
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Extract system message and user messages
    system_content = messages[0]["content"]
    user_messages = messages[1:]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_content,
        messages=user_messages,
    )

    # Extract response text and token count
    response_text = response.content[0].text
    token_count = response.usage.input_tokens + response.usage.output_tokens

    return response_text, example_ids, token_count


async def generate_response_streaming(
    db: AsyncSession,
    chat: Chat,
    user_message: str,
):
    """
    Generate an AI response with streaming (for future real-time UI).

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
    messages = build_full_prompt(
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        examples=examples,
        conversation_history=conversation_history,
        current_message=user_message,
        language=chat.language,
    )

    # Call Claude API with streaming
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    system_content = messages[0]["content"]
    user_messages = messages[1:]

    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_content,
        messages=user_messages,
    ) as stream:
        full_text = ""
        for text in stream.text_stream:
            full_text += text
            yield text

        # Return metadata after streaming completes
        yield {
            "type": "metadata",
            "example_ids": example_ids,
            "token_count": stream.get_final_message().usage.input_tokens
            + stream.get_final_message().usage.output_tokens,
        }
