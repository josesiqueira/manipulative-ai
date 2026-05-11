"""
Session management endpoints.

Sessions are created automatically when a participant visits the app.
No consent or demographics — that's handled outside the app.
"""

import uuid
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Session

router = APIRouter()


class SessionResponse(BaseModel):
    """Response after creating a session."""

    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(db: AsyncSession = Depends(get_db)):
    """Create a new participant session."""
    session = Session()
    db.add(session)
    await db.flush()
    await db.refresh(session)

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
    )


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

    return SessionResponse(
        id=session.id,
        created_at=session.created_at,
    )
