from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Participant, Chat, Message
from ..services.block_assignment import assign_political_block
from ..services.llm_client import generate_response
from ..services.conversation_logger import save_conversation_log

router = APIRouter()

VALID_TOPICS = [
    "immigration", "healthcare", "economy", "education",
    "foreign_policy", "environment", "technology", "equality", "social_welfare"
]

VALID_BLOCKS = ["conservative", "red-green", "moderate", "dissatisfied"]


class ChatCreate(BaseModel):
    """Request body for creating a new chat."""

    participant_id: str
    topic_category: str
    language: str = "en"


class ChatResponse(BaseModel):
    """
    Response after creating a chat.

    CRITICAL: political_block is NEVER included here for regular participants.
    This would reveal the experimental condition.
    """

    id: str
    topic_category: str
    language: str
    is_complete: bool

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    """Request body for sending a message."""

    content: str


class MessageResponse(BaseModel):
    """Response for a single message."""

    id: str
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatCompleteRequest(BaseModel):
    """Request body for completing a chat with survey responses."""

    perceived_leaning: str  # Participant's guess
    persuasiveness: int  # 1-5
    naturalness: int  # 1-5
    confidence: int  # 1-5


class ChatCompleteResponse(BaseModel):
    """Response after completing a chat (can now reveal block)."""

    id: str
    political_block: str  # Only revealed AFTER survey completion
    topic_category: str
    perceived_leaning: str
    persuasiveness: int
    naturalness: int
    confidence: int
    correct_guess: bool

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    data: ChatCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new chat session.

    The political block is secretly assigned using stratified randomization.
    NEVER expose the block to the participant until survey completion.
    """
    # Validate topic
    if data.topic_category not in VALID_TOPICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Must be one of: {VALID_TOPICS}",
        )

    # Validate language
    if data.language not in ("en", "fi"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language must be 'en' or 'fi'",
        )

    # Verify participant exists and has consent
    result = await db.execute(
        select(Participant).where(Participant.id == data.participant_id)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    if not participant.consent_given:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consent required to participate",
        )

    # Assign political block (stratified random)
    political_block = await assign_political_block(db, participant.id)

    chat = Chat(
        participant_id=participant.id,
        political_block=political_block,
        topic_category=data.topic_category,
        language=data.language,
        is_test_mode=False,
    )

    db.add(chat)
    await db.flush()
    await db.refresh(chat)

    # NOTE: political_block is intentionally NOT included in response
    return ChatResponse(
        id=chat.id,
        topic_category=chat.topic_category,
        language=chat.language,
        is_complete=chat.is_complete,
    )


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get chat details (without revealing political block)."""
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    return ChatResponse(
        id=chat.id,
        topic_category=chat.topic_category,
        language=chat.language,
        is_complete=chat.is_complete,
    )


@router.get("/{chat_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all messages in a chat."""
    result = await db.execute(
        select(Chat).options(selectinload(Chat.messages)).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    return [
        MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at,
        )
        for msg in chat.messages
    ]


@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: str,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message and get AI response.

    The AI response is generated using few-shot prompting with examples
    from the assigned political block.
    """
    # Get chat with messages
    result = await db.execute(
        select(Chat).options(selectinload(Chat.messages)).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    if chat.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat has been completed",
        )

    # Save user message
    user_message = Message(
        chat_id=chat.id,
        role="user",
        content=data.content,
    )
    db.add(user_message)

    # Generate AI response
    ai_content, examples_used, tokens = await generate_response(
        db=db,
        chat=chat,
        user_message=data.content,
    )

    # Save assistant message
    assistant_message = Message(
        chat_id=chat.id,
        role="assistant",
        content=ai_content,
        examples_used_ids=examples_used,
        token_count=tokens,
    )
    db.add(assistant_message)

    await db.flush()
    await db.refresh(assistant_message)

    return MessageResponse(
        id=assistant_message.id,
        role=assistant_message.role,
        content=assistant_message.content,
        created_at=assistant_message.created_at,
    )


@router.put("/{chat_id}/complete", response_model=ChatCompleteResponse)
async def complete_chat(
    chat_id: str,
    data: ChatCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete a chat with survey responses.

    After completion, the political block is revealed to allow
    the participant to see if their guess was correct.
    Also saves the conversation log to a file.
    """
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.messages), selectinload(Chat.participant))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )

    if chat.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat already completed",
        )

    # Validate perceived_leaning
    if data.perceived_leaning not in VALID_BLOCKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid perceived leaning. Must be one of: {VALID_BLOCKS}",
        )

    # Validate ratings (1-5)
    for field, value in [
        ("persuasiveness", data.persuasiveness),
        ("naturalness", data.naturalness),
        ("confidence", data.confidence),
    ]:
        if not 1 <= value <= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field} must be between 1 and 5",
            )

    # Update chat with survey responses
    chat.perceived_leaning = data.perceived_leaning
    chat.persuasiveness = data.persuasiveness
    chat.naturalness = data.naturalness
    chat.confidence = data.confidence
    chat.is_complete = True
    chat.completed_at = datetime.now(UTC)

    await db.flush()
    await db.refresh(chat)

    # Save conversation log to file
    try:
        log_path = save_conversation_log(chat, chat.participant)
        print(f"Conversation log saved: {log_path}")
    except Exception as e:
        print(f"Warning: Failed to save conversation log: {e}")

    # NOW we can reveal the political block
    return ChatCompleteResponse(
        id=chat.id,
        political_block=chat.political_block,
        topic_category=chat.topic_category,
        perceived_leaning=chat.perceived_leaning,
        persuasiveness=chat.persuasiveness,
        naturalness=chat.naturalness,
        confidence=chat.confidence,
        correct_guess=chat.perceived_leaning == chat.political_block,
    )
