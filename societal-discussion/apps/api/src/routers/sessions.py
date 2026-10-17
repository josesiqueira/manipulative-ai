"""
Session management endpoints.

A participant session is created by the consent page after the participant
ticks every box. Try-bot creates sessions without a body; those never carry
consent and are only usable through the admin conversation endpoint.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Message, Session, SurveyResponse
from ..services.party_grounding import PARTY_DISPLAY_NAMES, base_party, is_populist
from ..services.session_code import format_session_code

HELSINKI = ZoneInfo("Europe/Helsinki")

router = APIRouter()


class SessionCreate(BaseModel):
    """Optional consent payload sent by the participant consent page."""

    consent_version: str
    age_confirmed: bool = False
    language: str = "fi"


class SessionResponse(BaseModel):
    """Session as seen by the participant. Never includes parties."""

    id: str
    created_at: datetime
    consent_accepted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


def _to_response(session: Session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
        consent_accepted_at=session.consent_accepted_at,
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Create a session. With a body, record consent (age confirmation required)."""
    session = Session()
    if data is not None:
        if not data.age_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Age confirmation required",
            )
        session.consent_version = data.consent_version
        session.consent_language = data.language if data.language in ("fi", "en") else "fi"
        session.age_confirmed = True
        session.consent_accepted_at = datetime.now(HELSINKI)

    db.add(session)
    await db.flush()
    await db.refresh(session)
    return _to_response(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get session details."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return _to_response(session)


class DebriefConversation(BaseModel):
    id: str
    party_display_name: str
    is_populist: bool
    started_at: datetime


class DebriefResponse(BaseModel):
    """Revealed only after the survey exists. This is the one participant
    endpoint that discloses the experimental condition."""

    session_code: str
    data_deleted: bool
    conversations: list[DebriefConversation]


@router.get("/{session_id}/debrief", response_model=DebriefResponse)
async def get_debrief(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.conversations), selectinload(Session.survey_responses))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not session.survey_responses:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Survey not submitted")

    conversations = sorted(session.conversations, key=lambda c: c.started_at)
    return DebriefResponse(
        session_code=format_session_code(session.id),
        data_deleted=session.data_deleted_at is not None,
        conversations=[
            DebriefConversation(
                id=c.id,
                party_display_name=PARTY_DISPLAY_NAMES[base_party(c.assigned_party)],
                is_populist=is_populist(c.assigned_party),
                started_at=c.started_at,
            )
            for c in conversations
        ],
    )


@router.delete("/{session_id}/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_data(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Participant-initiated deletion (thank-you page, or by emailed code).

    Removes message and survey rows. Conversation rows stay as a tombstone
    (condition, timestamps, no content) so the arm counts remain auditable.
    """
    result = await db.execute(
        select(Session).options(selectinload(Session.conversations)).where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    conversation_ids = [c.id for c in session.conversations]
    if conversation_ids:
        await db.execute(Message.__table__.delete().where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(SurveyResponse.__table__.delete().where(SurveyResponse.session_id == session.id))
    now = datetime.now(HELSINKI)
    for c in session.conversations:
        c.is_complete = True
        if c.ended_at is None:
            c.ended_at = now
    session.data_deleted_at = now
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
