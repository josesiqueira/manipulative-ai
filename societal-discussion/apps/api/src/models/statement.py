from sqlalchemy import String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class PoliticalStatement(Base):
    """
    Political statements from the curated dataset.
    Used for few-shot prompting the AI agents.

    Note: 'political' terminology is internal only - never exposed to participants.
    """

    __tablename__ = "political_statements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # External ID from the original dataset (for traceability)
    external_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)

    # Bilingual content
    final_output_en: Mapped[str] = mapped_column(Text, nullable=False)
    final_output_fi: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    intention_of_statement: Mapped[str] = mapped_column(Text, nullable=False)
    topic_detailed: Mapped[str] = mapped_column(String(255), nullable=False)
    topic_category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    political_block: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    def get_content(self, language: str = "en") -> str:
        """Get statement content in the specified language."""
        if language == "fi" and self.final_output_fi:
            return self.final_output_fi
        return self.final_output_en

    def __repr__(self) -> str:
        return f"<PoliticalStatement {self.id}: {self.political_block}/{self.topic_category}>"
