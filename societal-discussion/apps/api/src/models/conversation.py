import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import TYPE_CHECKING

HELSINKI = ZoneInfo("Europe/Helsinki")

from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .session import Session
    from .message import Message


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id"), nullable=False, index=True
    )
    assigned_party: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # one of services.party_grounding.ALL_PARTIES (9 Finnish parties)
    language: Mapped[str] = mapped_column(
        String(2), nullable=False, default="fi"
    )  # 'fi' or 'en' — which language the bot should respond in
    is_flagged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )  # admin-set flag for follow-up review
    flag_notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # optional admin notes about why the conversation is flagged
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(HELSINKI)
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    starter_topic: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # NULL for free conversation
    is_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_test_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session", back_populates="conversations"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    @property
    def message_count(self) -> int:
        return len(self.messages)
