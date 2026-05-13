"""add conversation.language

Revision ID: 002_lang
Revises: 001_v2
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa


revision = '002_lang'
down_revision = '001_v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'conversations',
        sa.Column('language', sa.String(2), nullable=False, server_default='fi'),
    )


def downgrade() -> None:
    op.drop_column('conversations', 'language')
