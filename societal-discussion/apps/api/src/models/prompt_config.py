"""
Prompt configuration model — stores editable system instruction per party.

Researchers can customize how each party's bot behaves via the admin panel.
If no config exists for a party, the hardcoded default from prompt_builder.py is used.
"""

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

HELSINKI = ZoneInfo("Europe/Helsinki")

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PromptConfig(Base):
    __tablename__ = "prompt_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )

    # Party identifier — one of services.party_grounding.ALL_PARTIES (9 Finnish parties)
    party: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Editable system instruction text (the behavioral prompt, NOT the party program)
    # This is the text that tells the bot how to behave. The party program is appended automatically.
    system_instruction: Mapped[str] = mapped_column(Text, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(HELSINKI)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(HELSINKI),
        onupdate=lambda: datetime.now(HELSINKI),
    )
