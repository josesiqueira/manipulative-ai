"""
Survey submission endpoint.

Survey is submitted once per session, after all conversations are done.
Responses are stored as JSONB for flexibility.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Session, SurveyResponse

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
    db: AsyncSession = Depends(get_db),
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
