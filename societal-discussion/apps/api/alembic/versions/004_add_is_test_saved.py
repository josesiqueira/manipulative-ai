"""add conversations.is_test_saved

Test-mode conversations are now opt-in saved: by default a Try-bot run is
ephemeral and disappears when the researcher leaves; clicking "Save" flips
this flag so the conversation persists and is counted on the dashboard.

Revision ID: 004_tsv
Revises: 003_flag
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa


revision = '004_tsv'
down_revision = '003_flag'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('is_test_saved', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'is_test_saved')
