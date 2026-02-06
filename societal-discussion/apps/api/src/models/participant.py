import uuid
from datetime import datetime, UTC
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .chat import Chat


class Participant(Base):
    """
    Research participant who has given consent.
    Stores demographics and links to their chat sessions.
    """

    __tablename__ = "participants"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Session management
    session_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )

    # Language preference (en/fi)
    language: Mapped[str] = mapped_column(String(2), nullable=False, default="en")

    # Demographics (optional, collected at consent)
    age_group: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    education: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Pre-study political leaning (1-5 scale: 1=very left, 5=very right)
    political_leaning: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Self-reported political knowledge (1-5 scale)
    political_knowledge: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Consent tracking
    consent_given: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_timestamp: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    chats: Mapped[list["Chat"]] = relationship(
        "Chat", back_populates="participant", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Participant {self.id[:8]}... lang={self.language}>"
