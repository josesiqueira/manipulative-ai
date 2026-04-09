"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-01-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create political_statements table
    op.create_table(
        'political_statements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('external_id', sa.Integer(), nullable=False),
        sa.Column('final_output_en', sa.Text(), nullable=False),
        sa.Column('final_output_fi', sa.Text(), nullable=True),
        sa.Column('intention_of_statement', sa.Text(), nullable=False),
        sa.Column('topic_detailed', sa.String(255), nullable=False),
        sa.Column('topic_category', sa.String(50), nullable=False),
        sa.Column('political_block', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('external_id'),
    )
    op.create_index('ix_political_statements_external_id', 'political_statements', ['external_id'])
    op.create_index('ix_political_statements_topic_category', 'political_statements', ['topic_category'])
    op.create_index('ix_political_statements_political_block', 'political_statements', ['political_block'])

    # Create participants table
    op.create_table(
        'participants',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('session_token', sa.String(64), nullable=False),
        sa.Column('language', sa.String(2), nullable=False),
        sa.Column('age_group', sa.String(20), nullable=True),
        sa.Column('gender', sa.String(20), nullable=True),
        sa.Column('education', sa.String(50), nullable=True),
        sa.Column('political_leaning', sa.Integer(), nullable=True),
        sa.Column('political_knowledge', sa.Integer(), nullable=True),
        sa.Column('consent_given', sa.Boolean(), nullable=False),
        sa.Column('consent_timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_token'),
    )
    op.create_index('ix_participants_session_token', 'participants', ['session_token'])

    # Create chats table
    op.create_table(
        'chats',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('participant_id', sa.String(36), nullable=False),
        sa.Column('political_block', sa.String(50), nullable=False),
        sa.Column('topic_category', sa.String(50), nullable=False),
        sa.Column('language', sa.String(2), nullable=False),
        sa.Column('perceived_leaning', sa.String(50), nullable=True),
        sa.Column('persuasiveness', sa.Integer(), nullable=True),
        sa.Column('naturalness', sa.Integer(), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=True),
        sa.Column('is_complete', sa.Boolean(), nullable=False),
        sa.Column('is_test_mode', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['participant_id'], ['participants.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chats_participant_id', 'chats', ['participant_id'])

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('chat_id', sa.String(36), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('examples_used_ids', sa.JSON(), nullable=True),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['chat_id'], ['chats.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_messages_chat_id', 'messages', ['chat_id'])


def downgrade() -> None:
    op.drop_index('ix_messages_chat_id', table_name='messages')
    op.drop_table('messages')
    op.drop_index('ix_chats_participant_id', table_name='chats')
    op.drop_table('chats')
    op.drop_index('ix_participants_session_token', table_name='participants')
    op.drop_table('participants')
    op.drop_index('ix_political_statements_political_block', table_name='political_statements')
    op.drop_index('ix_political_statements_topic_category', table_name='political_statements')
    op.drop_index('ix_political_statements_external_id', table_name='political_statements')
    op.drop_table('political_statements')
