import uuid
from datetime import datetime, UTC
from typing import TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .participant import Participant
    from .message import Message


class Chat(Base):
    """
    A single chat session between a participant and an AI agent.

    The political_block is secretly assigned and NEVER exposed to the participant
    until after they complete the survey.
    """

    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Foreign key to participant
    participant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("participants.id"), nullable=False, index=True
    )

    # INTERNAL: Assigned political block (never exposed to participant)
    political_block: Mapped[str] = mapped_column(String(50), nullable=False)

    # Topic selected by participant
    topic_category: Mapped[str] = mapped_column(String(50), nullable=False)

    # Language of this chat session
    language: Mapped[str] = mapped_column(String(2), nullable=False, default="en")

    # Post-chat survey responses
    # Participant's guess of AI's political leaning (internal: did they detect the block?)
    perceived_leaning: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Persuasiveness rating (1-5): "How convincing were the arguments?"
    persuasiveness: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Naturalness rating (1-5): "How natural did the conversation feel?"
    naturalness: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Confidence in their perception (1-5)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status flags
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_test_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Cached few-shot examples (set once at chat creation, reused for all messages)
    few_shot_examples: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    participant: Mapped["Participant"] = relationship("Participant", back_populates="chats")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at"
    )

    @property
    def message_count(self) -> int:
        return len(self.messages)

    def __repr__(self) -> str:
        return f"<Chat {self.id[:8]}... block={self.political_block} topic={self.topic_category}>"
