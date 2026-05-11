"""manipulative-ai2 initial schema

Revision ID: 001_v2
Revises:
Create Date: 2026-04-09

Tables:
- sessions: participant sessions (no demographics)
- conversations: chat sessions with assigned party
- messages: individual messages in conversations
- survey_responses: JSONB survey answers
- llm_configs: LLM provider configuration
- experiment_configs: experiment settings
"""
from alembic import op
import sqlalchemy as sa


revision = '001_v2'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sessions
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_test_mode', sa.Boolean(), nullable=False, server_default='false'),
    )

    # Conversations
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('sessions.id'), nullable=False),
        sa.Column('assigned_party', sa.String(50), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('starter_topic', sa.Text(), nullable=True),
        sa.Column('is_complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_test_mode', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.create_index('idx_conversations_session', 'conversations', ['session_id'])

    # Messages
    op.create_table(
        'messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('conversation_id', sa.String(36), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('context_chunks_used', sa.Text(), nullable=True),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('idx_messages_conversation', 'messages', ['conversation_id'])

    # Survey responses
    op.create_table(
        'survey_responses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('sessions.id'), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('responses', sa.JSON(), nullable=False),
    )
    op.create_index('idx_survey_session', 'survey_responses', ['session_id'])

    # LLM configs
    op.create_table(
        'llm_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider', sa.String(20), unique=True, nullable=False),
        sa.Column('display_name', sa.String(50), nullable=False),
        sa.Column('encrypted_api_key', sa.Text(), nullable=True),
        sa.Column('selected_model', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # Experiment configs
    op.create_table(
        'experiment_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('experiment_name_en', sa.String(200), nullable=False,
                  server_default='Vaalikeskustelu Experiment'),
        sa.Column('experiment_name_fi', sa.String(200), nullable=False,
                  server_default='Vaalikeskustelukoe'),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('institution_name_en', sa.String(200), nullable=True),
        sa.Column('institution_name_fi', sa.String(200), nullable=True),
        sa.Column('ethics_board_name', sa.String(200), nullable=True),
        sa.Column('ethics_reference_number', sa.String(100), nullable=True),
        sa.Column('principal_investigator_name', sa.String(200), nullable=True),
        sa.Column('principal_investigator_email', sa.String(200), nullable=True),
        sa.Column('min_exchanges_before_survey', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('max_exchanges_per_chat', sa.Integer(), nullable=True),
        sa.Column('idle_timeout_minutes', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('experiment_configs')
    op.drop_table('llm_configs')
    op.drop_table('survey_responses')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('sessions')
