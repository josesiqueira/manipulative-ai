"""
LLM configuration model - stores LLM provider settings and encrypted API keys.
"""

import uuid
from datetime import datetime, UTC

from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class LLMConfig(Base):
    """
    Stores LLM provider configurations including encrypted API keys.

    Researchers can configure which LLM provider to use (OpenAI or Anthropic)
    and set API keys securely through the admin panel.
    """

    __tablename__ = "llm_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Provider identifier ('openai' or 'anthropic')
    provider: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Display name for the provider
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Encrypted API key (stored using Fernet encryption)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Selected model for this provider
    selected_model: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Whether this provider is currently active
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<LLMConfig {self.provider} active={self.is_active}>"
