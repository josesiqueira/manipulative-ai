import secrets
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Participant

router = APIRouter()


class ParticipantCreate(BaseModel):
    """Request body for creating a new participant."""

    language: str = "en"
    age_group: str | None = None
    gender: str | None = None
    education: str | None = None
    political_leaning: int | None = None  # 1-5 scale
    political_knowledge: int | None = None  # 1-5 scale
    consent_given: bool = False


class ParticipantResponse(BaseModel):
    """Response after creating a participant."""

    id: str
    session_token: str
    language: str
    consent_given: bool

    model_config = ConfigDict(from_attributes=True)


class ParticipantDetail(BaseModel):
    """Detailed participant info (for returning user)."""

    id: str
    language: str
    age_group: str | None
    gender: str | None
    education: str | None
    political_leaning: int | None
    political_knowledge: int | None
    consent_given: bool
    chat_count: int

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    data: ParticipantCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new research participant after consent.

    This is called when a user submits the consent form.
    Returns a session token for subsequent API calls.
    """
    if not data.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent must be given to participate",
        )

    # Validate language
    if data.language not in ("en", "fi"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language must be 'en' or 'fi'",
        )

    # Generate secure session token
    session_token = secrets.token_urlsafe(48)

    participant = Participant(
        session_token=session_token,
        language=data.language,
        age_group=data.age_group,
        gender=data.gender,
        education=data.education,
        political_leaning=data.political_leaning,
        political_knowledge=data.political_knowledge,
        consent_given=True,
        consent_timestamp=datetime.now(UTC),
    )

    db.add(participant)
    await db.flush()
    await db.refresh(participant)

    return ParticipantResponse(
        id=participant.id,
        session_token=session_token,
        language=participant.language,
        consent_given=participant.consent_given,
    )


@router.get("/{participant_id}", response_model=ParticipantDetail)
async def get_participant(
    participant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get participant details by ID.
    """
    result = await db.execute(
        select(Participant)
        .options(selectinload(Participant.chats))
        .where(Participant.id == participant_id)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    return ParticipantDetail(
        id=participant.id,
        language=participant.language,
        age_group=participant.age_group,
        gender=participant.gender,
        education=participant.education,
        political_leaning=participant.political_leaning,
        political_knowledge=participant.political_knowledge,
        consent_given=participant.consent_given,
        chat_count=len(participant.chats),
    )


@router.get("/by-token/{session_token}", response_model=ParticipantDetail)
async def get_participant_by_token(
    session_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get participant details by session token.
    Used for returning participants to resume their session.
    """
    result = await db.execute(
        select(Participant)
        .options(selectinload(Participant.chats))
        .where(Participant.session_token == session_token)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return ParticipantDetail(
        id=participant.id,
        language=participant.language,
        age_group=participant.age_group,
        gender=participant.gender,
        education=participant.education,
        political_leaning=participant.political_leaning,
        political_knowledge=participant.political_knowledge,
        consent_given=participant.consent_given,
        chat_count=len(participant.chats),
    )
