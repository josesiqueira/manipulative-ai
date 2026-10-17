"""add consent and deletion columns to sessions

Metso public demo (23.10.2026): the consent page records acceptance on the
session; "Delete my data" stamps data_deleted_at.

Revision ID: 005_consent
Revises: 004_tsv
Create Date: 2026-10-17
"""
from alembic import op
import sqlalchemy as sa


revision = '005_consent'
down_revision = '004_tsv'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('consent_accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sessions', sa.Column('consent_version', sa.String(40), nullable=True))
    op.add_column('sessions', sa.Column('consent_language', sa.String(2), nullable=True))
    op.add_column(
        'sessions',
        sa.Column('age_confirmed', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column('sessions', sa.Column('data_deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('sessions') as batch:
        batch.drop_column('data_deleted_at')
        batch.drop_column('age_confirmed')
        batch.drop_column('consent_language')
        batch.drop_column('consent_version')
        batch.drop_column('consent_accepted_at')
