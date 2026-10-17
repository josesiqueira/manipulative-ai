"""
Session management endpoints.

A participant session is created by the consent page after the participant
ticks every box. Try-bot creates sessions without a body; those never carry
consent and are only usable through the admin conversation endpoint.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Session

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
