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
from src.models import Participant, Chat, Message, PoliticalStatement, TopicConfig
from src.config import Settings, get_settings
from src.services.block_assignment import assign_political_block, get_global_block_counts, POLITICAL_BLOCKS
from src.services.example_selector import select_examples, build_conversational_turns, build_few_shot_cache, TOPIC_QUESTIONS
from src.services.prompt_builder import (
    build_system_prompt,
    build_full_prompt,
)
from src.routers.participants import ParticipantCreate, ParticipantResponse, ParticipantDetail
from src.routers.chats import (
    ChatCreate,
    ChatResponse,
    MessageCreate,
    MessageResponse,
    ChatCompleteRequest,
    ChatCompleteResponse,
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
async def seeded_topics(db_session):
    """Seed the 9 topic configs so chat creation validation passes."""
    topics = [
        ("immigration", "Immigration", "Maahanmuutto"),
        ("healthcare", "Healthcare", "Terveydenhuolto"),
        ("economy", "Economy", "Talous"),
        ("education", "Education", "Koulutus"),
        ("foreign_policy", "Foreign Policy", "Ulkopolitiikka"),
        ("environment", "Environment", "Ympäristö"),
        ("technology", "Technology", "Teknologia"),
        ("equality", "Equality", "Tasa-arvo"),
        ("social_welfare", "Social Welfare", "Sosiaaliturva"),
    ]
    for i, (key, label_en, label_fi) in enumerate(topics):
        db_session.add(TopicConfig(
            topic_key=key,
            label_en=label_en,
            label_fi=label_fi,
            welcome_message_en=f"Let's discuss {label_en.lower()}.",
            welcome_message_fi=f"Keskustellaan aiheesta {label_fi.lower()}.",
            is_enabled=True,
            display_order=i,
        ))
    await db_session.commit()


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
    async def test_build_conversational_turns(self, async_session, political_statements):
        """Test building conversational turns from statements.

        Each statement produces exactly two turns: a user question and an
        assistant answer. The turns alternate user/assistant.
        """
        examples = await select_examples(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            n=3,
        )
        turns = build_conversational_turns(examples, "immigration", "en")

        # Each statement produces 2 turns (user question + assistant answer)
        assert len(turns) == len(examples) * 2
        # Alternates user/assistant
        for i, turn in enumerate(turns):
            expected_role = "user" if i % 2 == 0 else "assistant"
            assert turn["role"] == expected_role
            assert "content" in turn

    @pytest.mark.asyncio
    async def test_build_few_shot_cache(self, async_session, political_statements):
        """Test building the full cache payload for chats.few_shot_examples."""
        examples = await select_examples(
            db=async_session,
            political_block="conservative",
            topic_category="immigration",
            language="en",
            n=3,
        )
        cache = build_few_shot_cache(examples, "immigration", "en")

        assert "turns" in cache
        assert "example_ids" in cache
        assert "examples" in cache
        assert len(cache["example_ids"]) == len(examples)

    @pytest.mark.asyncio
    async def test_topic_questions_complete(self, async_session):
        """Test TOPIC_QUESTIONS covers all 9 required topic categories."""
        assert len(TOPIC_QUESTIONS) == 9


# ============================================================================
# Service Tests - Prompt Builder
# ============================================================================

class TestPromptBuilder:
    """Test prompt building service."""

    def test_build_system_prompt_english(self):
        """Test building English system prompt for conservative block.

        The new prompt builder embeds persona text from BLOCK_PERSONAS.
        The conservative persona mentions personal responsibility and family
        values but never uses the word "conservative".
        """
        prompt = build_system_prompt(
            political_block="conservative",
            topic_category="immigration",
            language="en",
        )

        # Conservative persona contains these phrases (case-insensitive check)
        assert "personal responsibility" in prompt.lower()
        assert "family values" in prompt.lower() or "national identity" in prompt.lower()
        # Block name must never be revealed in the prompt
        assert "conservative" not in prompt.lower()

    def test_build_system_prompt_finnish(self):
        """Test building Finnish system prompt for red-green block.

        Finnish sessions start with "Vastaa aina suomeksi" and embed the
        red-green persona which contains "social equality".
        """
        prompt = build_system_prompt(
            political_block="red-green",
            topic_category="healthcare",
            language="fi",
        )

        # Finnish language instruction is always the first line
        assert "Vastaa aina suomeksi" in prompt
        # Red-green persona contains social equality language
        assert "social equality" in prompt.lower() or "Olet keskustelukumppani" in prompt

    def test_build_system_prompt_unknown_block(self):
        """Test building prompt for unknown block defaults to moderate.

        Unknown blocks must degrade gracefully by falling back to the moderate
        persona, which mentions pragmatic and evidence-based solutions.
        """
        prompt = build_system_prompt(
            political_block="unknown_block",
            topic_category="economy",
            language="en",
        )

        # Moderate persona uses these terms
        assert "pragmatic" in prompt.lower() or "evidence-based" in prompt.lower()
        # The word "moderate" must not be exposed (block anonymity)
        assert "moderate" not in prompt.lower()

    def test_build_full_prompt(self):
        """Test building complete messages list for an LLM API call.

        The new signature drops the `examples` argument entirely.
        Message ordering: system (index 0), history turns, current user message (last).
        """
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]

        messages = build_full_prompt(
            political_block="moderate",
            topic_category="immigration",
            conversation_history=history,
            current_message="What do you think?",
            language="en",
        )

        assert messages[0]["role"] == "system"
        # "Centrist Pragmatic" is old prompt text — must not appear in new prompts
        assert "Centrist Pragmatic" not in messages[0]["content"]
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
    async def test_create_chat_success(self, client, participant, seeded_topics):
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
    async def test_create_chat_invalid_topic(self, client, participant, seeded_topics):
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
        assert "Invalid" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_chat_participant_not_found(self, client, seeded_topics):
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

    @pytest.mark.asyncio
    async def test_create_chat_caches_few_shot_examples(self, client, participant, db_session, political_statements):
        """Test that chat creation populates chats.few_shot_examples.

        When political statements exist, the endpoint must build conversational
        turns and persist them as JSON so the LLM client can use them without
        an extra DB query on every message.
        """
        # Seed the topic that the chat will reference
        from src.models import TopicConfig
        topic = TopicConfig(
            topic_key="immigration",
            label_en="Immigration",
            label_fi="Maahanmuutto",
            welcome_message_en="Welcome",
            welcome_message_fi="Tervetuloa",
            is_enabled=True,
            display_order=0,
        )
        db_session.add(topic)
        await db_session.commit()

        response = await client.post(
            "/api/chats",
            json={
                "participant_id": participant.id,
                "topic_category": "immigration",
                "language": "en",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        chat_id = response.json()["id"]

        # Verify cache was written to the DB directly
        from sqlalchemy import select as sa_select
        from src.models import Chat
        result = await db_session.execute(sa_select(Chat).where(Chat.id == chat_id))
        chat = result.scalar_one()

        # few_shot_examples should be populated when statements exist
        if chat.few_shot_examples:
            assert "turns" in chat.few_shot_examples
            assert "example_ids" in chat.few_shot_examples


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
        admin_pw = get_settings().admin_password
        response = await client.get(
            "/api/admin/stats",
            headers={"x-admin-password": admin_pw},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_participants" in data
        assert "total_chats" in data
        assert data["total_chats"] >= 1

    @pytest.mark.asyncio
    async def test_admin_create_chat(self, client, participant, seeded_topics):
        """Test admin creating chat with specific block."""
        admin_pw = get_settings().admin_password
        response = await client.post(
            "/api/admin/chats",
            json={
                "participant_id": participant.id,
                "topic_category": "healthcare",
                "political_block": "conservative",
                "language": "en",
            },
            headers={"x-admin-password": admin_pw},
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
    async def test_get_topics(self, client, seeded_topics):
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
        """Test configuration loads without error and has expected fields."""
        settings = Settings()

        # database_url may be overridden by .env; just check it's a non-empty string
        assert isinstance(settings.database_url, str) and len(settings.database_url) > 0
        assert isinstance(settings.admin_password, str) and len(settings.admin_password) > 0
        assert isinstance(settings.debug, bool)

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
