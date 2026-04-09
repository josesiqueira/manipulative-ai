"""Add few_shot_examples JSON column to chats table

Revision ID: 007
Revises: 006
Create Date: 2026-03-31

Few-shot examples are cached at chat creation time and stored here so every
subsequent message in the session reuses the same examples without re-querying
the database or regenerating them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '007_few_shot_examples'
down_revision: Union[str, None] = '006_timezone_timestamps'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable JSON column to store cached few-shot examples per chat session.
    # Nullable so existing rows remain valid without backfilling.
    op.add_column('chats', sa.Column('few_shot_examples', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('chats', 'few_shot_examples')
