"""Add LLM config table

Revision ID: 004_llm_config
Revises: 003_terms_config
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_llm_config'
down_revision = '003_terms_config'
branch_labels = None
depends_on = None

# Default LLM configurations to seed
DEFAULT_LLM_CONFIGS = [
    {
        "provider": "openai",
        "display_name": "OpenAI",
        "selected_model": "gpt-4o",
        "is_active": True,
    },
    {
        "provider": "anthropic",
        "display_name": "Anthropic",
        "selected_model": "claude-sonnet-4-5-20250514",
        "is_active": False,
    },
]


def upgrade():
    # Create llm_configs table
    op.create_table(
        'llm_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider', sa.String(20), unique=True, nullable=False),
        sa.Column('display_name', sa.String(50), nullable=False),
        sa.Column('encrypted_api_key', sa.Text, nullable=True),
        sa.Column('selected_model', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Seed with default LLM configurations
    import uuid
    from datetime import datetime, UTC

    for config in DEFAULT_LLM_CONFIGS:
        op.execute(
            sa.text("""
                INSERT INTO llm_configs (id, provider, display_name, encrypted_api_key, selected_model, is_active, created_at, updated_at)
                VALUES (:id, :provider, :display_name, :encrypted_api_key, :selected_model, :is_active, :now, :now)
            """).bindparams(
                id=str(uuid.uuid4()),
                provider=config["provider"],
                display_name=config["display_name"],
                encrypted_api_key=None,
                selected_model=config["selected_model"],
                is_active=config["is_active"],
                now=datetime.now(UTC),
            )
        )


def downgrade():
    op.drop_table('llm_configs')
