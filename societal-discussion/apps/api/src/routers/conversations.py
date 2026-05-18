"""
Conversation endpoints.

Handles creating conversations (with party assignment), sending messages,
and ending conversations.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

HELSINKI = ZoneInfo("Europe/Helsinki")

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models import Session, Conversation, Message
from ..services.party_assignment import assign_party
from ..services.party_grounding import ALL_PARTIES
from ..services.llm_client import generate_response
from ..services.conversation_logger import save_conversation_log

router = APIRouter()


class ConversationCreate(BaseModel):
    """Request body for creating a new conversation."""

    session_id: str
    starter_topic: str | None = None
    language: str = "fi"  # 'fi' or 'en'


class ConversationResponse(BaseModel):
    """
    Response after creating a conversation.

    CRITICAL: assigned_party is NEVER included here.
    This would reveal the experimental condition.
    """

    id: str
    starter_topic: str | None
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


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new conversation.

    The party is secretly assigned using no-repeat weighted logic.
    NEVER expose the party to the participant.
    """
    # Verify session exists
    result = await db.execute(
        select(Session).where(Session.id == data.session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Assign party. If FORCED_PARTY is set in the env, every conversation
    # goes to that party (used during the HEPP demo to point all traffic
    # at a single party). Otherwise fall back to the normal no-repeat
    # weighted-random assignment.
    settings = get_settings()
    if settings.forced_party and settings.forced_party in ALL_PARTIES:
        assigned_party = settings.forced_party
    else:
        assigned_party = await assign_party(db, session.id)

    language = data.language if data.language in ("fi", "en") else "fi"

    conversation = Conversation(
        session_id=session.id,
        assigned_party=assigned_party,
        language=language,
        starter_topic=data.starter_topic,
        is_test_mode=session.is_test_mode,
    )

    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)

    # NOTE: assigned_party is intentionally NOT included in response
    return ConversationResponse(
        id=conversation.id,
        starter_topic=conversation.starter_topic,
        is_complete=conversation.is_complete,
    )


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get conversation details (without revealing assigned party)."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return ConversationResponse(
        id=conversation.id,
        starter_topic=conversation.starter_topic,
        is_complete=conversation.is_complete,
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all messages in a conversation."""
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    return [
        MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at,
        )
        for msg in conversation.messages
    ]


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message and get AI response.

    The AI response is generated using the full party program text
    injected into the system prompt.
    """
    # Get conversation with messages
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if conversation.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation has been completed",
        )

    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=data.content,
    )
    db.add(user_message)

    # Generate AI response
    try:
        ai_content, tokens = await generate_response(
            db=db,
            conversation=conversation,
            user_message=data.content,
        )
    except Exception as e:
        print(f"LLM error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vastauksen generointi epäonnistui. Yritä uudelleen.",
        )

    # Save assistant message
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_content,
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


@router.put("/{conversation_id}/end")
async def end_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a conversation as ended.
    Called when user clicks "Back to start" or "End conversation".
    """
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    conversation.is_complete = True
    conversation.ended_at = datetime.now(HELSINKI)

    await db.flush()

    # Save conversation log to file
    try:
        log_path = save_conversation_log(conversation)
        print(f"Conversation log saved: {log_path}")
    except Exception as e:
        print(f"Warning: Failed to save conversation log: {e}")

    return {"status": "ok", "message": "Conversation ended"}
