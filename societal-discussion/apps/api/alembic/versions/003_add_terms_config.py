"""Add terms config table

Revision ID: 003_terms_config
Revises: 002_prompt_configs
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_terms_config'
down_revision = '002_prompt_configs'
branch_labels = None
depends_on = None


def upgrade():
    # Create terms_configs table
    op.create_table(
        'terms_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title_en', sa.String(200), nullable=False),
        sa.Column('title_fi', sa.String(200), nullable=False),
        sa.Column('content_en', sa.Text, nullable=False),
        sa.Column('content_fi', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )


def downgrade():
    op.drop_table('terms_configs')
