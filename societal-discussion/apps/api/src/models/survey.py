import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import TYPE_CHECKING

HELSINKI = ZoneInfo("Europe/Helsinki")

from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .session import Session


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id"), nullable=False, index=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(HELSINKI)
    )
    responses: Mapped[dict] = mapped_column(JSON, nullable=False)

    session: Mapped["Session"] = relationship(
        "Session", back_populates="survey_responses"
    )
