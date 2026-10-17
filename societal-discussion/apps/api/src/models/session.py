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

    # Consent (participant flow only; try-bot sessions leave these empty).
    # The checkboxes are TENK ethics consent, not the GDPR legal basis; see
    # docs/consent/2026-10-23-metso-consent-package.md section 1.3.
    consent_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consent_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    consent_language: Mapped[str | None] = mapped_column(
        String(2), nullable=True
    )  # 'fi' or 'en': the language the consent texts were shown in
    age_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Set when the participant used "Delete my data"; message and survey rows
    # are gone, conversation rows stay as a tombstone (condition, timestamps).
    data_deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="session", cascade="all, delete-orphan"
    )
    survey_responses: Mapped[list["SurveyResponse"]] = relationship(
        "SurveyResponse", back_populates="session", cascade="all, delete-orphan"
    )
