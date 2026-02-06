import uuid
from datetime import datetime, UTC
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .chat import Chat


class Message(Base):
    """
    Individual message in a chat conversation.
    Tracks both user messages and AI responses, including which
    few-shot examples were used to generate each response.
    """

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Foreign key to chat
    chat_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chats.id"), nullable=False, index=True
    )

    # Message content
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # For assistant messages: which dataset examples were used in few-shot prompting
    # Stored as JSON array of statement IDs: [1, 5, 12]
    examples_used_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Token usage tracking (for cost analysis)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")

    def __repr__(self) -> str:
        preview = self.content[:30] + "..." if len(self.content) > 30 else self.content
        return f"<Message {self.role}: {preview}>"
