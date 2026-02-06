"""
Tests for the societal-discussion FastAPI backend.

Covers:
- Pydantic models validation
- Router endpoints
- Service functions (block assignment, example selection, prompt building)
- Database operations
"""

import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import status
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import app and models
import sys
sys.path.insert(0, str(__file__).rsplit("/tests", 1)[0] + "/src")

from src.main import app
from src.database import Base, get_db
from src.models import Participant, Chat, Message, PoliticalStatement
from src.config import Settings, get_settings
from src.services.block_assignment import assign_political_block, get_global_block_counts, POLITICAL_BLOCKS
from src.services.example_selector import select_examples, get_examples_for_prompt
from src.services.prompt_builder import (
    build_system_prompt,
    build_few_shot_section,
    build_full_prompt,
    BLOCK_IDENTITIES,
)
from src.routers.participants import ParticipantCreate, ParticipantResponse, ParticipantDetail
from src.routers.chats import (
    ChatCreate,
    ChatResponse,
    MessageCreate,
    MessageResponse,
    ChatCompleteRequest,
    ChatCompleteResponse,
    VALID_TOPICS,
    VALID_BLOCKS,
)
from src.routers.admin import AdminChatCreate, AdminChatResponse, StatsResponse, CoverageResponse


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_engine():
    """Create an async in-memory SQLite engine for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def async_session(async_engine):
    """Create an async session for testing."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session_maker() as session:
        yield session


@pytest.fixture
async def db_session(async_engine):
    """Create a database session that overrides the FastAPI dependency."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db():
        async with async_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with async_session_maker() as session:
        yield session

    app.dependency_overrides.clear()


@pytest.fixture
async def client(db_session):
    """Create an async test client."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def participant(db_session):
    """Create a test participant."""
    p = Participant(
        session_token="test_token_12345",
        language="en",
        consent_given=True,
        consent_timestamp=datetime.now(UTC),
        age_group="25-34",
        gender="prefer_not_to_say",
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest.fixture
async def chat(db_session, participant):
    """Create a test chat."""
    c = Chat(
        participant_id=participant.id,
        political_block="moderate",
        topic_category="immigration",
        language="en",
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest.fixture
async def political_statements(db_session):
    """Create test political statements."""
    statements = [
        PoliticalStatement(
            external_id=1,
            final_output_en="Immigration should be controlled to protect jobs.",
            final_output_fi="Maahanmuuttoa tulisi hallita tyopaikkojen suojelemiseksi.",
            intention_of_statement="economic protection",
            topic_detailed="Immigration policy",
            topic_category="immigration",
            political_block="conservative",
        ),
        PoliticalStatement(
            external_id=2,
            final_output_en="We need open borders for humanitarian reasons.",
            final_output_fi="Tarvitsemme avoimet rajat humanitaarisista syista.",
            intention_of_statement="humanitarian concern",
            topic_detailed="Immigration policy",
            topic_category="immigration",
            political_block="red-green",
        ),
        PoliticalStatement(
            external_id=3,
            final_output_en="A balanced approach to immigration works best.",
            final_output_fi=None,
            intention_of_statement="pragmatic approach",
            topic_detailed="Immigration policy",
            topic_category="immigration",
            political_block="moderate",
        ),
        PoliticalStatement(
            external_id=4,
            final_output_en="Healthcare spending needs reform.",
            final_output_fi="Terveysmenoja on uudistettava.",
            intention_of_statement="fiscal responsibility",
            topic_detailed="Healthcare funding",
            topic_category="healthcare",
            political_block="conservative",
        ),
    ]
    for stmt in statements:
        db_session.add(stmt)
    await db_session.commit()
    return statements


# ============================================================================
# Pydantic Model Tests
# ============================================================================

class TestPydanticModels:
    """Test Pydantic model validation."""

    def test_participant_create_valid(self):
        """Test valid participant creation."""
        data = ParticipantCreate(
            language="en",
            age_group="25-34",
            consent_given=True,
        )
        assert data.language == "en"
        assert data.consent_given is True

    def test_participant_create_defaults(self):
        """Test default values for participant creation."""
        data = ParticipantCreate()
        assert data.language == "en"
        assert data.consent_given is False
        assert data.age_group is None

    def test_chat_create_valid(self):
        """Test valid chat creation."""
        data = ChatCreate(
            participant_id="test-id",
            topic_category="immigration",
            language="fi",
        )
        assert data.topic_category == "immigration"
        assert data.language == "fi"

    def test_message_create_valid(self):
        """Test valid message creation."""
        data = MessageCreate(content="Hello, how are you?")
        assert data.content == "Hello, how are you?"

    def test_chat_complete_request_valid(self):
        """Test valid chat completion request."""
        data = ChatCompleteRequest(
            perceived_leaning="conservative",
            persuasiveness=4,
            naturalness=5,
            confidence=3,
        )
        assert data.perceived_leaning == "conservative"
        assert data.persuasiveness == 4

    def test_admin_chat_create_valid(self):
        """Test valid admin chat creation."""
        data = AdminChatCreate(
            participant_id="test-id",
            topic_category="healthcare",
            political_block="red-green",
            language="en",
        )
        assert data.political_block == "red-green"


# ============================================================================
# Service Tests - Block Assignment
# ============================================================================

class TestBlockAssignment:
    """Test political block assignment service."""

    @pytest.mark.asyncio
    async def test_assign_block_first_chat(self, async_session):
        """Test block assignment for a participant's first chat."""
        # Create a participant without any chats
        participant = Participant(
            session_token="new_participant_token",
            language="en",
            consent_given=True,
            consent_timestamp=datetime.now(UTC),
        )
        async_session.add(participant)
        await async_session.commit()

        block = await assign_political_block(async_session, participant.id)

        assert block in POLITICAL_BLOCKS

    @pytest.mark.asyncio
    async def test_assign_block_prefers_unseen(self, async_session):
        """Test that block assignment prefers unseen blocks."""
        # Create participant with one chat
        participant = Participant(
            session_token="returning_participant",
            language="en",
            consent_given=True,
            consent_timestamp=datetime.now(UTC),
        )
        async_session.add(participant)
        await async_session.commit()

        # Add a chat with "conservative" block
        chat = Chat(
            participant_id=participant.id,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            is_test_mode=False,
        )
        async_session.add(chat)
        await async_session.commit()

        # Get multiple assignments and check they tend to avoid "conservative"
        blocks = []
        for _ in range(10):
            block = await assign_political_block(async_session, participant.id)
            blocks.append(block)

        # Should mostly get non-conservative blocks
        non_conservative = [b for b in blocks if b != "conservative"]
        assert len(non_conservative) >= 5  # At least half should be different

    @pytest.mark.asyncio
    async def test_get_global_block_counts(self, async_session):
        """Test getting global block counts."""
        # Add some chats
        participant = Participant(
            session_token="count_test",
            language="en",
            consent_given=True,
            consent_timestamp=datetime.now(UTC),
        )
        async_session.add(participant)
        await async_session.commit()

        for block in ["conservative", "conservative", "moderate"]:
            chat = Chat(
                participant_id=participant.id,
                political_block=block,
                topic_category="immigration",
                language="en",
                is_test_mode=False,
            )
            async_session.add(chat)
        await async_session.commit()

        counts = await get_global_block_counts(async_session)

        assert counts["conservative"] == 2
        assert counts["moderate"] == 1
        assert counts["red-green"] == 0
        assert counts["dissatisfied"] == 0


# ============================================================================
# Service Tests - Example Selector
# ============================================================================

class TestExampleSelector:
    """Test example selection service."""

    @pytest.mark.asyncio
    async def test_select_examples_exact_match(self, async_session, political_statements):
        """Test selecting examples with exact topic and block match."""
        examples = await select_examples(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            n=3,
        )

        assert len(examples) >= 1
        for ex in examples:
            assert ex.political_block == "conservative"

    @pytest.mark.asyncio
    async def test_select_examples_fallback(self, async_session, political_statements):
        """Test fallback to different topic when exact match insufficient."""
        examples = await select_examples(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            n=3,
        )

        # Should get examples (may include fallback from healthcare)
        assert len(examples) >= 1
        for ex in examples:
            assert ex.political_block == "conservative"

    @pytest.mark.asyncio
    async def test_select_examples_finnish(self, async_session, political_statements):
        """Test selecting examples in Finnish."""
        examples = await select_examples(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="fi",
            n=3,
        )

        # Should only return statements with Finnish translations
        for ex in examples:
            assert ex.final_output_fi is not None

    @pytest.mark.asyncio
    async def test_get_examples_for_prompt(self, async_session, political_statements):
        """Test getting formatted examples for prompt."""
        formatted, ids = await get_examples_for_prompt(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            n=2,
        )

        assert len(formatted) == len(ids)
        for ex in formatted:
            assert "topic" in ex
            assert "intention" in ex
            assert "text" in ex


# ============================================================================
# Service Tests - Prompt Builder
# ============================================================================

class TestPromptBuilder:
    """Test prompt building service."""

    def test_build_system_prompt_english(self):
        """Test building English system prompt."""
        prompt = build_system_prompt(
            political_block="conservative",
            topic_category="immigration",
            language="en",
        )

        assert "Traditional Values Perspective" in prompt
        assert "Personal responsibility" in prompt
        assert "English" in prompt

    def test_build_system_prompt_finnish(self):
        """Test building Finnish system prompt."""
        prompt = build_system_prompt(
            political_block="red-green",
            topic_category="healthcare",
            language="fi",
        )

        assert "Edistyksellinen sosiaalinen nakokulma" in prompt or "edistyksellinen" in prompt.lower()
        assert "suomeksi" in prompt.lower()

    def test_build_system_prompt_unknown_block(self):
        """Test building prompt for unknown block defaults to moderate."""
        prompt = build_system_prompt(
            political_block="unknown_block",
            topic_category="economy",
            language="en",
        )

        assert "Centrist Pragmatic Perspective" in prompt

    def test_build_few_shot_section_english(self):
        """Test building few-shot section in English."""
        examples = [
            {"topic": "Immigration", "intention": "protect jobs", "text": "Control borders"},
            {"topic": "Immigration", "intention": "safety", "text": "Secure borders first"},
        ]

        section = build_few_shot_section(examples, language="en")

        assert "Examples of your perspective" in section
        assert "Topic:" in section
        assert "Intent:" in section
        assert "Example 1" in section
        assert "Example 2" in section

    def test_build_few_shot_section_finnish(self):
        """Test building few-shot section in Finnish."""
        examples = [
            {"topic": "Maahanmuutto", "intention": "suojaa tyopaikkoja", "text": "Hallitse rajoja"},
        ]

        section = build_few_shot_section(examples, language="fi")

        assert "Esimerkkeja nakokulmastasi" in section or "Esimerkkej" in section
        assert "Aihe:" in section
        assert "Tarkoitus:" in section

    def test_build_few_shot_section_empty(self):
        """Test building few-shot section with no examples."""
        section = build_few_shot_section([], language="en")
        assert section == ""

    def test_build_full_prompt(self):
        """Test building complete prompt for API call."""
        examples = [
            {"topic": "Immigration", "intention": "test", "text": "Test statement"},
        ]
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]

        messages = build_full_prompt(
            political_block="moderate",
            topic_category="immigration",
            examples=examples,
            conversation_history=history,
            current_message="What do you think?",
            language="en",
        )

        assert messages[0]["role"] == "system"
        assert "Centrist Pragmatic" in messages[0]["content"]
        assert len(messages) == 4  # system + 2 history + current
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "What do you think?"


# ============================================================================
# Router Tests - Participants
# ============================================================================

class TestParticipantRouter:
    """Test participant router endpoints."""

    @pytest.mark.asyncio
    async def test_create_participant_success(self, client):
        """Test successful participant creation."""
        response = await client.post(
            "/api/participants",
            json={
                "language": "en",
                "consent_given": True,
                "age_group": "25-34",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "id" in data
        assert "session_token" in data
        assert data["consent_given"] is True

    @pytest.mark.asyncio
    async def test_create_participant_no_consent(self, client):
        """Test participant creation fails without consent."""
        response = await client.post(
            "/api/participants",
            json={
                "language": "en",
                "consent_given": False,
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Consent must be given" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_participant_invalid_language(self, client):
        """Test participant creation fails with invalid language."""
        response = await client.post(
            "/api/participants",
            json={
                "language": "de",  # Invalid - only en/fi supported
                "consent_given": True,
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Language must be" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_participant(self, client, participant):
        """Test getting participant by ID."""
        response = await client.get(f"/api/participants/{participant.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == participant.id
        assert data["language"] == "en"

    @pytest.mark.asyncio
    async def test_get_participant_not_found(self, client):
        """Test getting non-existent participant."""
        response = await client.get("/api/participants/non-existent-id")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_participant_by_token(self, client, participant):
        """Test getting participant by session token."""
        response = await client.get(
            f"/api/participants/by-token/{participant.session_token}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == participant.id


# ============================================================================
# Router Tests - Chats
# ============================================================================

class TestChatRouter:
    """Test chat router endpoints."""

    @pytest.mark.asyncio
    async def test_create_chat_success(self, client, participant):
        """Test successful chat creation."""
        response = await client.post(
            "/api/chats",
            json={
                "participant_id": participant.id,
                "topic_category": "immigration",
                "language": "en",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "id" in data
        assert data["topic_category"] == "immigration"
        # political_block should NOT be exposed
        assert "political_block" not in data

    @pytest.mark.asyncio
    async def test_create_chat_invalid_topic(self, client, participant):
        """Test chat creation fails with invalid topic."""
        response = await client.post(
            "/api/chats",
            json={
                "participant_id": participant.id,
                "topic_category": "invalid_topic",
                "language": "en",
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid topic" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_chat_participant_not_found(self, client):
        """Test chat creation fails with non-existent participant."""
        response = await client.post(
            "/api/chats",
            json={
                "participant_id": "non-existent-id",
                "topic_category": "immigration",
                "language": "en",
            },
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_chat(self, client, chat):
        """Test getting chat by ID."""
        response = await client.get(f"/api/chats/{chat.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == chat.id
        # political_block should NOT be exposed
        assert "political_block" not in data

    @pytest.mark.asyncio
    async def test_get_messages_empty(self, client, chat):
        """Test getting messages from empty chat."""
        response = await client.get(f"/api/chats/{chat.id}/messages")

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_complete_chat(self, client, chat):
        """Test completing a chat with survey."""
        response = await client.put(
            f"/api/chats/{chat.id}/complete",
            json={
                "perceived_leaning": "moderate",
                "persuasiveness": 4,
                "naturalness": 5,
                "confidence": 3,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # NOW political_block should be revealed
        assert "political_block" in data
        assert data["correct_guess"] is True  # Guessed "moderate", actual is "moderate"

    @pytest.mark.asyncio
    async def test_complete_chat_invalid_rating(self, client, chat):
        """Test completing chat fails with invalid rating."""
        response = await client.put(
            f"/api/chats/{chat.id}/complete",
            json={
                "perceived_leaning": "moderate",
                "persuasiveness": 6,  # Invalid - must be 1-5
                "naturalness": 5,
                "confidence": 3,
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "must be between 1 and 5" in response.json()["detail"]


# ============================================================================
# Router Tests - Admin
# ============================================================================

class TestAdminRouter:
    """Test admin router endpoints."""

    @pytest.mark.asyncio
    async def test_get_stats_unauthorized(self, client):
        """Test stats endpoint requires admin password."""
        response = await client.get("/api/admin/stats")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_get_stats_success(self, client, chat):
        """Test getting stats with valid admin password."""
        response = await client.get(
            "/api/admin/stats",
            headers={"x-admin-password": "admin"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_participants" in data
        assert "total_chats" in data
        assert data["total_chats"] >= 1

    @pytest.mark.asyncio
    async def test_admin_create_chat(self, client, participant):
        """Test admin creating chat with specific block."""
        response = await client.post(
            "/api/admin/chats",
            json={
                "participant_id": participant.id,
                "topic_category": "healthcare",
                "political_block": "conservative",
                "language": "en",
            },
            headers={"x-admin-password": "admin"},
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        # Admin can see political_block
        assert data["political_block"] == "conservative"
        assert data["is_test_mode"] is True


# ============================================================================
# Health Check Test
# ============================================================================

class TestHealthCheck:
    """Test health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Test health check returns healthy status."""
        response = await client.get("/api/health")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


# ============================================================================
# Topics Endpoint Test
# ============================================================================

class TestTopicsEndpoint:
    """Test topics endpoint."""

    @pytest.mark.asyncio
    async def test_get_topics(self, client):
        """Test getting available topics."""
        response = await client.get("/api/topics")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "topics" in data
        topics = data["topics"]
        assert len(topics) == 9  # 9 topics defined

        # Check structure
        for topic in topics:
            assert "id" in topic
            assert "label_en" in topic
            assert "label_fi" in topic


# ============================================================================
# Model Tests - SQLAlchemy
# ============================================================================

class TestSQLAlchemyModels:
    """Test SQLAlchemy model definitions."""

    @pytest.mark.asyncio
    async def test_participant_model(self, async_session):
        """Test Participant model creation and defaults."""
        p = Participant(
            session_token="model_test_token",
            language="fi",
            consent_given=True,
            consent_timestamp=datetime.now(UTC),
        )
        async_session.add(p)
        await async_session.commit()
        await async_session.refresh(p)

        assert p.id is not None
        assert len(p.id) == 36  # UUID format
        assert p.language == "fi"
        assert p.consent_given is True

    @pytest.mark.asyncio
    async def test_chat_model(self, async_session, participant):
        """Test Chat model creation and relationships."""
        c = Chat(
            participant_id=participant.id,
            political_block="red-green",
            topic_category="environment",
            language="en",
        )
        async_session.add(c)
        await async_session.commit()
        await async_session.refresh(c)

        assert c.id is not None
        assert c.is_complete is False
        assert c.is_test_mode is False

    @pytest.mark.asyncio
    async def test_message_model(self, async_session, chat):
        """Test Message model creation."""
        m = Message(
            chat_id=chat.id,
            role="user",
            content="Test message content",
        )
        async_session.add(m)
        await async_session.commit()
        await async_session.refresh(m)

        assert m.id is not None
        assert m.role == "user"
        assert m.created_at is not None

    @pytest.mark.asyncio
    async def test_political_statement_model(self, async_session):
        """Test PoliticalStatement model."""
        stmt = PoliticalStatement(
            external_id=999,
            final_output_en="Test statement in English",
            final_output_fi="Test statement in Finnish",
            intention_of_statement="testing",
            topic_detailed="Test Topic",
            topic_category="education",
            political_block="moderate",
        )
        async_session.add(stmt)
        await async_session.commit()
        await async_session.refresh(stmt)

        assert stmt.id is not None
        assert stmt.get_content("en") == "Test statement in English"
        assert stmt.get_content("fi") == "Test statement in Finnish"
        assert stmt.get_content("de") == "Test statement in English"  # Fallback to English

    @pytest.mark.asyncio
    async def test_political_statement_no_finnish(self, async_session):
        """Test PoliticalStatement falls back to English when Finnish is None."""
        stmt = PoliticalStatement(
            external_id=1000,
            final_output_en="English only statement",
            final_output_fi=None,
            intention_of_statement="testing",
            topic_detailed="Test",
            topic_category="technology",
            political_block="dissatisfied",
        )
        async_session.add(stmt)
        await async_session.commit()

        assert stmt.get_content("fi") == "English only statement"


# ============================================================================
# Config Tests
# ============================================================================

class TestConfig:
    """Test configuration settings."""

    def test_default_settings(self):
        """Test default configuration values."""
        settings = Settings()

        assert settings.database_url == "sqlite+aiosqlite:///./societal_discussion.db"
        assert settings.admin_password == "admin"
        assert settings.debug is False

    def test_cors_origins_list(self):
        """Test CORS origins parsing."""
        settings = Settings(cors_origins="http://localhost:3000,http://localhost:8080")

        origins = settings.cors_origins_list
        assert len(origins) == 2
        assert "http://localhost:3000" in origins
        assert "http://localhost:8080" in origins

    def test_cors_origins_single(self):
        """Test single CORS origin."""
        settings = Settings(cors_origins="http://example.com")

        origins = settings.cors_origins_list
        assert len(origins) == 1
        assert origins[0] == "http://example.com"
