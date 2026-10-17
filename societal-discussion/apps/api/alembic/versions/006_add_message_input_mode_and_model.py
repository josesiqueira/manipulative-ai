"""add input_mode and model_name to messages

Metso public demo (23.10.2026): participants can type or speak; the analysis
must tell the two apart, and the methods section needs the model per reply.

Revision ID: 006_msg_mode
Revises: 005_consent
Create Date: 2026-10-17
"""
from alembic import op
import sqlalchemy as sa


revision = '006_msg_mode'
down_revision = '005_consent'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'messages',
        sa.Column('input_mode', sa.String(10), nullable=False, server_default='typed'),
    )
    op.add_column('messages', sa.Column('model_name', sa.String(100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('messages') as batch:
        batch.drop_column('model_name')
        batch.drop_column('input_mode')
