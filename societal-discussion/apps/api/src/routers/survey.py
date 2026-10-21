"""
Survey submission endpoint.

Survey is submitted once per session, after all conversations are done.
Responses are stored as JSONB for flexibility.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Conversation, Session, SurveyResponse

HELSINKI = ZoneInfo("Europe/Helsinki")

router = APIRouter()


class SurveySubmit(BaseModel):
    """Request body for submitting survey responses."""

    session_id: str
    responses: dict  # Flexible JSONB — schema TBD by research team


class SurveySubmitResponse(BaseModel):
    """Response after submitting survey."""

    id: str
    session_id: str

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=SurveySubmitResponse, status_code=status.HTTP_201_CREATED)
async def submit_survey(
    data: SurveySubmit,
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """
    Submit survey responses.

    Called after the participant finishes all conversations.
    Stores responses as JSONB for flexible schema.
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

    if not session.is_test_mode and session.consent_accepted_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Consent required")
    if session.data_deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session data deleted")
    existing = await db.execute(select(SurveyResponse.id).where(SurveyResponse.session_id == session.id))
    if existing.first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Survey already submitted")

    # The debrief follows the survey and names the party, so every
    # conversation of the session ends here: nothing said after it is data.
    await db.execute(
        update(Conversation)
        .where(Conversation.session_id == session.id, Conversation.is_complete == False)  # noqa: E712
        .values(is_complete=True, ended_at=datetime.now(HELSINKI))
    )

    survey = SurveyResponse(
        session_id=session.id,
        responses=data.responses,
    )

    db.add(survey)
    await db.flush()
    await db.refresh(survey)

    return SurveySubmitResponse(
        id=survey.id,
        session_id=survey.session_id,
    )
