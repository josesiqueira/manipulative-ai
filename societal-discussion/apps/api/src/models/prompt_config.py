"""
Prompt configuration model - stores editable bot prompts.
"""

import uuid
from datetime import datetime, UTC

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PromptConfig(Base):
    """
    Stores editable prompt configurations for each political block.

    Researchers can modify these through the admin panel without
    changing code.
    """

    __tablename__ = "prompt_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Political block this config is for
    political_block: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Display name
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_fi: Mapped[str] = mapped_column(String(100), nullable=False)

    # Full description/prompt for the AI
    description_en: Mapped[str] = mapped_column(Text, nullable=False)
    description_fi: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<PromptConfig {self.political_block}>"
