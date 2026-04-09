"""
Topic configuration model - stores discussion topic settings.
"""

import uuid
from datetime import datetime, UTC

from sqlalchemy import String, Text, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class TopicConfig(Base):
    """
    Stores discussion topic configurations including labels and welcome messages.

    Researchers can enable/disable topics, modify labels and welcome messages,
    and control display order through the admin panel.
    """

    __tablename__ = "topic_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Topic identifier (e.g., "immigration", "healthcare")
    topic_key: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )

    # Labels (bilingual)
    label_en: Mapped[str] = mapped_column(String(100), nullable=False)
    label_fi: Mapped[str] = mapped_column(String(100), nullable=False)

    # Welcome messages (bilingual)
    welcome_message_en: Mapped[str] = mapped_column(Text, nullable=False)
    welcome_message_fi: Mapped[str] = mapped_column(Text, nullable=False)

    # Status and ordering
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<TopicConfig {self.topic_key} enabled={self.is_enabled}>"
