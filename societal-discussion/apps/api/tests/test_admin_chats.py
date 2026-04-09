"""
Tests for the admin chat list and detail endpoints.

Covers:
- GET /api/admin/chats — paginated, filtered chat list
- GET /api/admin/chats/{chat_id}/detail — full chat detail with messages and survey

Authentication for all endpoints uses the x-admin-password header with the
value from settings.admin_password (not hardcoded).
"""

import pytest
from datetime import datetime, UTC

from fastapi import status
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

import sys
sys.path.insert(0, str(__file__).rsplit("/tests", 1)[0] + "/src")

from src.main import app
from src.database import Base, get_db
from src.models import Participant, Chat, Message
from src.config import get_settings


# ============================================================================
# Fixtures — same pattern as test_api.py
# ============================================================================


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def async_engine():
    """In-memory SQLite engine — created fresh for every test."""
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
async def db_session(async_engine):
    """
    Provide a session that is shared between the test body and the FastAPI
    dependency override.  Both sides use the same session-maker so they see
    the same in-memory database.
    """
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
    """Async test client using ASGITransport (no real network)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture
async def participant(db_session):
    """A minimal participant with consent."""
    p = Participant(
        session_token="admin_test_token_001",
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


async def _make_chat(db_session, participant, **kwargs) -> Chat:
    """
    Helper to create a Chat row with sensible defaults.  Any keyword arg
    overrides the default, so tests only spell out what they care about.
    """
    defaults = dict(
        participant_id=participant.id,
        political_block="moderate",
        topic_category="immigration",
        language="en",
        is_test_mode=False,
    )
    defaults.update(kwargs)
    chat = Chat(**defaults)
    db_session.add(chat)
    await db_session.commit()
    await db_session.refresh(chat)
    return chat


def _admin_headers() -> dict[str, str]:
    """Return the x-admin-password header dict for authenticated requests."""
    return {"x-admin-password": get_settings().admin_password}


# ============================================================================
# list_chats — authentication
# ============================================================================


class TestListChatsAuth:
    """The endpoint must refuse requests that omit the admin header."""

    @pytest.mark.asyncio
    async def test_list_chats_requires_auth(self, client):
        """No password header → 401 Unauthorized."""
        response = await client.get("/api/admin/chats")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# list_chats — basic structure
# ============================================================================


class TestListChatsBasic:
    """Shape and default-value tests for the chat list endpoint."""

    @pytest.mark.asyncio
    async def test_list_chats_empty(self, client):
        """Empty database → response envelope with zero items."""
        response = await client.get("/api/admin/chats", headers=_admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["chats"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["per_page"] == 20

    @pytest.mark.asyncio
    async def test_list_chats_returns_chats(self, client, db_session, participant):
        """A single non-test chat appears in the list with the expected fields."""
        chat = await _make_chat(db_session, participant)

        response = await client.get("/api/admin/chats", headers=_admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["chats"]) == 1

        item = data["chats"][0]
        assert item["id"] == chat.id
        assert item["political_block"] == "moderate"
        assert item["topic_category"] == "immigration"
        assert item["language"] == "en"
        assert item["message_count"] == 0
        assert item["is_test_mode"] is False
        assert item["correct_guess"] is None  # no survey yet


# ============================================================================
# list_chats — filters
# ============================================================================


class TestListChatsFilters:
    """Each query-param filter must narrow the result set correctly."""

    @pytest.mark.asyncio
    async def test_list_chats_filter_by_block(self, client, db_session, participant):
        """Filter political_block=conservative returns only conservative chats."""
        await _make_chat(db_session, participant, political_block="conservative")
        await _make_chat(db_session, participant, political_block="red-green")

        response = await client.get(
            "/api/admin/chats",
            params={"political_block": "conservative"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["chats"][0]["political_block"] == "conservative"

    @pytest.mark.asyncio
    async def test_list_chats_filter_by_topic(self, client, db_session, participant):
        """Filter topic_category=healthcare returns only healthcare chats."""
        await _make_chat(db_session, participant, topic_category="immigration")
        await _make_chat(db_session, participant, topic_category="healthcare")

        response = await client.get(
            "/api/admin/chats",
            params={"topic_category": "healthcare"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["chats"][0]["topic_category"] == "healthcare"

    @pytest.mark.asyncio
    async def test_list_chats_excludes_test_mode(self, client, db_session, participant):
        """
        By default (exclude_test=true) test-mode chats are hidden.
        Passing exclude_test=false reveals them.
        """
        # A test-mode chat (e.g. created via admin panel)
        await _make_chat(db_session, participant, is_test_mode=True)

        # Default request — test chat must be absent
        response = await client.get("/api/admin/chats", headers=_admin_headers())
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 0

        # With exclude_test=false — test chat must appear
        response = await client.get(
            "/api/admin/chats",
            params={"exclude_test": "false"},
            headers=_admin_headers(),
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_list_chats_filter_detection_correct(self, client, db_session, participant):
        """
        detection_result=correct returns only completed chats where
        perceived_leaning matches political_block.
        """
        # Correctly guessed chat: block and perceived_leaning both "moderate"
        await _make_chat(
            db_session,
            participant,
            political_block="moderate",
            is_complete=True,
            perceived_leaning="moderate",
            persuasiveness=4,
            naturalness=5,
            confidence=3,
        )
        # Incorrectly guessed chat
        await _make_chat(
            db_session,
            participant,
            political_block="conservative",
            is_complete=True,
            perceived_leaning="moderate",
            persuasiveness=3,
            naturalness=4,
            confidence=2,
        )

        response = await client.get(
            "/api/admin/chats",
            params={"detection_result": "correct"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["chats"][0]["correct_guess"] is True

    @pytest.mark.asyncio
    async def test_list_chats_filter_detection_pending(self, client, db_session, participant):
        """
        detection_result=pending returns chats that have not yet received a
        survey answer (perceived_leaning is NULL).
        """
        # Incomplete chat — no survey answer yet
        await _make_chat(db_session, participant, is_complete=False)
        # Completed chat with a survey answer
        await _make_chat(
            db_session,
            participant,
            is_complete=True,
            perceived_leaning="moderate",
            persuasiveness=4,
            naturalness=5,
            confidence=3,
        )

        response = await client.get(
            "/api/admin/chats",
            params={"detection_result": "pending"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Only the pending (no perceived_leaning) chat
        assert data["total"] == 1
        assert data["chats"][0]["correct_guess"] is None


# ============================================================================
# list_chats — pagination
# ============================================================================


class TestListChatsPagination:
    """Pagination parameters must be respected and totals must be accurate."""

    @pytest.mark.asyncio
    async def test_list_chats_pagination(self, client, db_session, participant):
        """
        Create 3 chats, request page 1 with per_page=2.
        The response must carry total=3 but only 2 items on this page.
        """
        for _ in range(3):
            await _make_chat(db_session, participant)

        response = await client.get(
            "/api/admin/chats",
            params={"page": 1, "per_page": 2},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 3
        assert data["per_page"] == 2
        assert len(data["chats"]) == 2


# ============================================================================
# get_chat_detail
# ============================================================================


class TestChatDetail:
    """Full detail endpoint for a single chat session."""

    @pytest.mark.asyncio
    async def test_chat_detail_success(self, client, db_session, participant):
        """
        A chat with one message returns the expected structure:
        messages array, survey block, and participant demographics.
        """
        chat = await _make_chat(
            db_session,
            participant,
            is_complete=True,
            perceived_leaning="moderate",
            persuasiveness=4,
            naturalness=5,
            confidence=3,
        )

        # Add a message to the chat
        msg = Message(
            chat_id=chat.id,
            role="user",
            content="What do you think about immigration?",
        )
        db_session.add(msg)
        await db_session.commit()

        response = await client.get(
            f"/api/admin/chats/{chat.id}/detail",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Top-level chat fields
        assert data["id"] == chat.id
        assert data["political_block"] == "moderate"
        assert data["topic_category"] == "immigration"

        # Messages list
        assert len(data["messages"]) == 1
        assert data["messages"][0]["role"] == "user"
        assert "content" in data["messages"][0]

        # Survey block
        survey = data["survey"]
        assert survey["perceived_leaning"] == "moderate"
        assert survey["correct_guess"] is True  # moderate == moderate
        assert survey["persuasiveness"] == 4
        assert survey["naturalness"] == 5
        assert survey["confidence"] == 3

        # Participant summary
        assert "participant" in data
        assert data["participant"]["age_group"] == "25-34"

    @pytest.mark.asyncio
    async def test_chat_detail_not_found(self, client):
        """Requesting a non-existent chat ID returns 404."""
        response = await client.get(
            "/api/admin/chats/non-existent-uuid/detail",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_chat_detail_includes_few_shot(self, client, db_session, participant):
        """
        When few_shot_examples is set on the chat (as a JSON blob), the detail
        response must echo it back verbatim under the few_shot_examples key.
        """
        few_shot_payload = {
            "turns": [{"role": "user", "content": "test"}],
            "example_ids": [1],
            "examples": [],
        }
        chat = await _make_chat(db_session, participant, few_shot_examples=few_shot_payload)

        response = await client.get(
            f"/api/admin/chats/{chat.id}/detail",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["few_shot_examples"] is not None
        assert data["few_shot_examples"]["example_ids"] == [1]
        assert len(data["few_shot_examples"]["turns"]) == 1
