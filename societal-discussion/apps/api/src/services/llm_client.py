"""
LLM client for generating AI responses using OpenAI API.
"""

from openai import OpenAI
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

    # Call OpenAI API
    client = OpenAI(api_key=settings.openai_api_key)

    # Convert to OpenAI format (system message is separate in our format)
    openai_messages = [{"role": "system", "content": messages[0]["content"]}]
    openai_messages.extend(messages[1:])

    response = client.chat.completions.create(
        model="gpt-5.2",
        max_completion_tokens=1024,
        messages=openai_messages,
    )

    # Extract response text and token count
    response_text = response.choices[0].message.content
    token_count = response.usage.total_tokens

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

    # Call OpenAI API with streaming
    client = OpenAI(api_key=settings.openai_api_key)

    openai_messages = [{"role": "system", "content": messages[0]["content"]}]
    openai_messages.extend(messages[1:])

    stream = client.chat.completions.create(
        model="gpt-5.2",
        max_completion_tokens=1024,
        messages=openai_messages,
        stream=True,
    )

    full_text = ""
    for chunk in stream:
        if chunk.choices[0].delta.content:
            text = chunk.choices[0].delta.content
            full_text += text
            yield text

    # Return metadata after streaming completes
    yield {
        "type": "metadata",
        "example_ids": example_ids,
        "token_count": len(full_text.split()) * 2,  # Rough estimate for streaming
    }
