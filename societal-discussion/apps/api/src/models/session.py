import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import TYPE_CHECKING

HELSINKI = ZoneInfo("Europe/Helsinki")

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .conversation import Conversation
    from .survey import SurveyResponse


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(HELSINKI)
    )
    is_test_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="session", cascade="all, delete-orphan"
    )
    survey_responses: Mapped[list["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="session", cascade="all, delete-orphan"
    )
