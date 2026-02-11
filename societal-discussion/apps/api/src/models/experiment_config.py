"""
Experiment configuration model - stores experiment metadata and session rules.
"""

import uuid
from datetime import datetime, date, UTC

from sqlalchemy import String, Text, DateTime, Date, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ExperimentConfig(Base):
    """
    Stores experiment metadata, session rules, and research information.

    This is a singleton table - only one row exists, containing the
    current experiment configuration. Researchers can modify these
    settings through the admin panel.
    """

    __tablename__ = "experiment_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Experiment identity (bilingual)
    experiment_name_en: Mapped[str] = mapped_column(
        String(200), nullable=False, default="Research Project"
    )
    experiment_name_fi: Mapped[str] = mapped_column(
        String(200), nullable=False, default="Tutkimushanke"
    )

    # Dates
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Ethics info
    ethics_board_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ethics_reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Principal investigator
    principal_investigator_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    principal_investigator_email: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Institution (bilingual)
    institution_name_en: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default="Tampere University"
    )
    institution_name_fi: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default="Tampereen yliopisto"
    )

    # Session rules
    min_exchanges_before_survey: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3
    )
    max_exchanges_per_chat: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    idle_timeout_minutes: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # Master switch
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<ExperimentConfig {self.experiment_name_en} active={self.is_active}>"
