"""add conversation flagging columns

Revision ID: 003_flag
Revises: 002_lang
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa


revision = '003_flag'
down_revision = '002_lang'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('is_flagged', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'conversations',
        sa.Column('flag_notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'flag_notes')
    op.drop_column('conversations', 'is_flagged')
