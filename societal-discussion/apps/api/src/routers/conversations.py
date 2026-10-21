"""
Conversation endpoints.

Handles creating conversations (with party assignment), sending messages,
and ending conversations.
"""

import random
from datetime import datetime
from zoneinfo import ZoneInfo

HELSINKI = ZoneInfo("Europe/Helsinki")

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..models import Session, Conversation, Message, SurveyResponse
from ..services.party_assignment import assign_party
from ..services.party_grounding import ALL_PARTIES
from ..services.llm_client import generate_reply, prepare_reply
from ..services.conversation_logger import save_conversation_log

router = APIRouter()

# Limits far above what a participant needs in a lecture, there only so one
# script cannot run up the model bill or fill the database.
MAX_MESSAGE_CHARS = 2000
MAX_USER_MESSAGES_PER_CONVERSATION = 40
MAX_CONVERSATIONS_PER_SESSION = 20


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

    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    input_mode: str = "typed"  # 'typed' or 'spoken' (speech already transcribed)


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
    db: AsyncSession = Depends(get_db, scope="function"),
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

    # Participants must have accepted the research notification on the
    # consent page. Try-bot sessions are exempt (is_test_mode).
    if not session.is_test_mode and session.consent_accepted_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consent required",
        )
    # A session whose data the participant deleted is a tombstone: no new
    # conversation may be stored under it (the browser starts a new session).
    if session.data_deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session data deleted",
        )

    # The survey closes the session: the debrief that follows it names the
    # party and the framing, and a conversation after that is not data.
    finished = await db.scalar(
        select(func.count()).select_from(SurveyResponse).where(SurveyResponse.session_id == session.id)
    )
    if finished:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session finished",
        )
    started = await db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.session_id == session.id)
    )
    if started >= MAX_CONVERSATIONS_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many conversations",
        )

    # Assign party. FORCED_PARTY can be:
    #   - empty                               → normal no-repeat weighted random
    #   - "perussuomalaiset_populist"         → every conversation goes there
    #   - "perussuomalaiset_populist,perussuomalaiset_antipopulist"
    #                                         → random pick between the listed
    #                                           parties (uniform; ignores
    #                                           per-session no-repeat)
    settings = get_settings()
    candidates = [
        p.strip() for p in (settings.forced_party or "").split(",") if p.strip()
    ]
    candidates = [p for p in candidates if p in ALL_PARTIES]
    if candidates:
        assigned_party = random.choice(candidates)
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
    db: AsyncSession = Depends(get_db, scope="function"),
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
    db: AsyncSession = Depends(get_db, scope="function"),
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
    db: AsyncSession = Depends(get_db, scope="function"),
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

    if not data.content.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Empty message")
    if sum(1 for m in conversation.messages if m.role == "user") >= MAX_USER_MESSAGES_PER_CONVERSATION:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many messages",
        )

    # The user message is built now (its time is the send time) but added to
    # the session only after the reply: nothing is written during the model
    # call, so the SQLite write lock is free for other participants.
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=data.content,
        input_mode=data.input_mode if data.input_mode in ("typed", "spoken") else "typed",
        created_at=datetime.now(HELSINKI),
    )

    # Read what the model call needs, then end the read transaction so the
    # database connection goes back to the pool during the model call (8 to
    # 30 s): with dozens of phones waiting for replies, held connections ran
    # out and every other request failed.
    try:
        prepared = await prepare_reply(db, conversation, data.content)
    except Exception as e:
        print(f"LLM setup error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vastauksen generointi epäonnistui. Yritä uudelleen.",
        )
    await db.commit()

    try:
        ai_content, tokens, model_name = await generate_reply(prepared)
    except Exception as e:
        print(f"LLM error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Vastauksen generointi epäonnistui. Yritä uudelleen.",
        )

    db.add(user_message)
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_content,
        token_count=tokens,
        model_name=model_name,
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
    db: AsyncSession = Depends(get_db, scope="function"),
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
