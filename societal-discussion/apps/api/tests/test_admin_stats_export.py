"""
Tests for admin endpoints added in Phase 2:
  - GET /api/admin/stats/detailed
  - GET /api/admin/export
  - GET /api/admin/statements

Authentication uses the x-admin-password header with the value from
get_settings().admin_password (never hardcoded).

Fixture pattern mirrors test_admin_chats.py: async_engine → db_session →
client, with the FastAPI get_db dependency overridden so the test body
and the router share the same in-memory SQLite database.
"""

import io
import zipfile
from datetime import datetime, UTC

import pytest
from fastapi import status
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

import sys
sys.path.insert(0, str(__file__).rsplit("/tests", 1)[0] + "/src")

from src.main import app
from src.database import Base, get_db
from src.models import Participant, Chat, Message, PoliticalStatement
from src.config import get_settings


# ============================================================================
# Fixtures
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
    Shared session between the test body and the FastAPI dependency override.
    Both sides use the same session-maker so they see the same in-memory DB.
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
        session_token="stats_test_token_001",
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


async def _make_statement(db_session, external_id: int, **kwargs) -> PoliticalStatement:
    """
    Helper to create a PoliticalStatement with sensible defaults.
    Only fields that differ from the defaults need to be passed.
    """
    defaults = dict(
        external_id=external_id,
        final_output_en="Test statement text.",
        intention_of_statement="test intention",
        topic_detailed="test topic",
        topic_category="immigration",
        political_block="conservative",
    )
    defaults.update(kwargs)
    stmt = PoliticalStatement(**defaults)
    db_session.add(stmt)
    await db_session.commit()
    await db_session.refresh(stmt)
    return stmt


def _admin_headers() -> dict[str, str]:
    """Return the x-admin-password header dict for authenticated requests."""
    return {"x-admin-password": get_settings().admin_password}


# ============================================================================
# GET /api/admin/stats/detailed — authentication
# ============================================================================


class TestDetailedStatsAuth:
    """The endpoint must refuse requests that omit the admin header."""

    @pytest.mark.asyncio
    async def test_detailed_stats_requires_auth(self, client):
        """No password header → 401 Unauthorized."""
        response = await client.get("/api/admin/stats/detailed")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# GET /api/admin/stats/detailed — response shape and data
# ============================================================================


class TestDetailedStatsEmpty:
    """With no data in the DB the endpoint must still return all expected keys."""

    @pytest.mark.asyncio
    async def test_detailed_stats_empty(self, client):
        """
        Empty database → all four top-level keys are present.
        block_accuracy must have an entry for every VALID_BLOCK with zero counts.
        coverage_matrix and persuasiveness_matrix may be empty dicts.
        """
        response = await client.get(
            "/api/admin/stats/detailed",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "block_accuracy" in data
        assert "persuasiveness_matrix" in data
        assert "length_distribution" in data
        assert "coverage_matrix" in data

        # All four VALID_BLOCKS must appear in block_accuracy even with no data.
        for block in ("conservative", "red-green", "moderate", "dissatisfied"):
            assert block in data["block_accuracy"]
            assert data["block_accuracy"][block]["total"] == 0
            assert data["block_accuracy"][block]["correct"] == 0
            assert data["block_accuracy"][block]["accuracy_pct"] == 0.0


class TestDetailedStatsBlockAccuracy:
    """
    Seed two completed non-test chats (one correct, one incorrect guess) and
    confirm block_accuracy reflects the right counts and percentages.
    """

    @pytest.mark.asyncio
    async def test_detailed_stats_block_accuracy(self, client, db_session, participant):
        """
        One chat where perceived_leaning == political_block (correct), one where
        they differ (incorrect).  For the 'moderate' block: total=2, correct=1,
        accuracy_pct=50.0.
        """
        # Correct guess: block and perceived_leaning are both "moderate"
        await _make_chat(
            db_session,
            participant,
            political_block="moderate",
            perceived_leaning="moderate",
            is_complete=True,
            persuasiveness=4,
            naturalness=4,
            confidence=3,
        )
        # Incorrect guess: assigned "moderate" but participant guessed "conservative"
        await _make_chat(
            db_session,
            participant,
            political_block="moderate",
            perceived_leaning="conservative",
            is_complete=True,
            persuasiveness=3,
            naturalness=3,
            confidence=2,
        )

        response = await client.get(
            "/api/admin/stats/detailed",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        moderate = response.json()["block_accuracy"]["moderate"]

        assert moderate["total"] == 2
        assert moderate["correct"] == 1
        assert moderate["accuracy_pct"] == pytest.approx(50.0)


class TestDetailedStatsCoverageMatrix:
    """
    Seed PoliticalStatements and verify coverage_matrix shows the right counts.
    """

    @pytest.mark.asyncio
    async def test_detailed_stats_coverage_matrix(self, client, db_session):
        """
        Two conservative/immigration statements and one moderate/healthcare
        statement → coverage_matrix reflects those exact counts.
        """
        await _make_statement(db_session, 1, political_block="conservative", topic_category="immigration")
        await _make_statement(db_session, 2, political_block="conservative", topic_category="immigration")
        await _make_statement(db_session, 3, political_block="moderate", topic_category="healthcare")

        response = await client.get(
            "/api/admin/stats/detailed",
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        matrix = response.json()["coverage_matrix"]

        assert matrix["conservative"]["immigration"] == 2
        assert matrix["moderate"]["healthcare"] == 1


# ============================================================================
# GET /api/admin/export — CSV and ZIP formats
# ============================================================================


class TestExportCSV:
    """Basic CSV export: content type, presence of expected columns."""

    @pytest.mark.asyncio
    async def test_export_csv_default(self, client, db_session, participant):
        """
        A single completed chat exported with format=csv (the default) must
        return text/csv content containing the chat_id and political_block.
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

        response = await client.get(
            "/api/admin/export",
            params={"format": "csv"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response.headers["content-type"]

        csv_text = response.text
        # Header row and at least one data row
        assert "chat_id" in csv_text
        assert chat.id in csv_text

    @pytest.mark.asyncio
    async def test_export_csv_filter_by_block(self, client, db_session, participant):
        """
        Two completed chats with different blocks; filtering by
        political_block=conservative must return only the conservative row.
        """
        conservative_chat = await _make_chat(
            db_session,
            participant,
            political_block="conservative",
            is_complete=True,
            perceived_leaning="conservative",
            persuasiveness=3,
            naturalness=3,
            confidence=2,
        )
        moderate_chat = await _make_chat(
            db_session,
            participant,
            political_block="moderate",
            is_complete=True,
            perceived_leaning="moderate",
            persuasiveness=4,
            naturalness=4,
            confidence=3,
        )

        response = await client.get(
            "/api/admin/export",
            params={"format": "csv", "political_block": "conservative"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        csv_text = response.text

        # Conservative chat must be present; moderate chat must be absent.
        assert conservative_chat.id in csv_text
        assert moderate_chat.id not in csv_text


class TestExportTextZip:
    """Text/ZIP export: content type must be application/zip."""

    @pytest.mark.asyncio
    async def test_export_text_zip(self, client, db_session, participant):
        """
        A completed chat with one message exported with format=text must return
        a valid ZIP archive (application/zip content-type).
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

        msg = Message(
            chat_id=chat.id,
            role="user",
            content="What do you think about immigration policy?",
        )
        db_session.add(msg)
        await db_session.commit()

        response = await client.get(
            "/api/admin/export",
            params={"format": "text"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        assert "application/zip" in response.headers["content-type"]

        # The body must be a valid ZIP archive.
        zip_bytes = io.BytesIO(response.content)
        assert zipfile.is_zipfile(zip_bytes), "Response body is not a valid ZIP archive"


# ============================================================================
# GET /api/admin/statements — authentication
# ============================================================================


class TestStatementsAuth:
    """The endpoint must refuse requests that omit the admin header."""

    @pytest.mark.asyncio
    async def test_statements_requires_auth(self, client):
        """No password header → 401 Unauthorized."""
        response = await client.get("/api/admin/statements")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# GET /api/admin/statements — listing and filtering
# ============================================================================


class TestStatementsList:
    """Basic listing and field-presence tests for the statements endpoint."""

    @pytest.mark.asyncio
    async def test_statements_list(self, client, db_session):
        """
        Seeded statements appear in the response with all expected fields:
        id, external_id, political_block, topic_category, topic_detailed,
        final_output_en, intention_of_statement.
        """
        await _make_statement(db_session, 10, political_block="conservative", topic_category="immigration")

        response = await client.get("/api/admin/statements", headers=_admin_headers())

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["statements"]) == 1

        item = data["statements"][0]
        assert item["external_id"] == 10
        assert item["political_block"] == "conservative"
        assert item["topic_category"] == "immigration"
        assert "final_output_en" in item
        assert "intention_of_statement" in item
        assert "topic_detailed" in item

    @pytest.mark.asyncio
    async def test_statements_filter_by_block(self, client, db_session):
        """
        Statements for two different blocks; filtering by political_block
        returns only the matching statements.
        """
        await _make_statement(db_session, 20, political_block="conservative", topic_category="immigration")
        await _make_statement(db_session, 21, political_block="moderate", topic_category="immigration")

        response = await client.get(
            "/api/admin/statements",
            params={"political_block": "conservative"},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["statements"][0]["political_block"] == "conservative"


# ============================================================================
# GET /api/admin/statements — pagination
# ============================================================================


class TestStatementsPagination:
    """Pagination parameters must be respected and the total must be accurate."""

    @pytest.mark.asyncio
    async def test_statements_pagination(self, client, db_session):
        """
        Seed 5 statements, request page 1 with per_page=2.
        The response must report total=5 but return only 2 items on this page.
        """
        for i in range(5):
            await _make_statement(
                db_session,
                external_id=100 + i,
                political_block="conservative",
                topic_category="immigration",
            )

        response = await client.get(
            "/api/admin/statements",
            params={"page": 1, "per_page": 2},
            headers=_admin_headers(),
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 5
        assert data["per_page"] == 2
        assert len(data["statements"]) == 2
