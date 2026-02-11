"""
Terms configuration model - stores editable consent/terms content.
"""

import uuid
from datetime import datetime, UTC

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class TermsConfig(Base):
    """
    Stores editable Terms of Use and Informed Consent content.

    Researchers can modify these through the admin panel without
    changing code. Only one row exists (singleton pattern).
    """

    __tablename__ = "terms_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # English content
    title_en: Mapped[str] = mapped_column(String(200), nullable=False, default="Terms of Use and Informed Consent")
    content_en: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Finnish content
    title_fi: Mapped[str] = mapped_column(String(200), nullable=False, default="Käyttöehdot ja tietoinen suostumus")
    content_fi: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<TermsConfig {self.id}>"
