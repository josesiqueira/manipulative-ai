"""The database commit must happen before the response leaves the server:
the phone sends its next request (consent, then a conversation, then a
message) as soon as it has the answer, and that request has to find the row.
FastAPI runs a yield dependency's exit code after the response by default."""
from httpx import ASGITransport, AsyncClient

from src.database import get_db
from src.main import app

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


async def test_commit_runs_before_the_response_starts(db_session):
    events: list[str] = []

    async def recording_db():
        try:
            yield db_session
            await db_session.commit()
            events.append("commit")
        except Exception:
            await db_session.rollback()
            raise

    async def recording_app(scope, receive, send):
        async def wrapped_send(message):
            if message["type"] == "http.response.start":
                events.append("response")
            await send(message)

        await app(scope, receive, wrapped_send)

    app.dependency_overrides[get_db] = recording_db
    try:
        transport = ASGITransport(app=recording_app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            res = await c.post("/api/sessions", json=CONSENT)
        assert res.status_code in (200, 201)
        assert events[:2] == ["commit", "response"], events
    finally:
        app.dependency_overrides.clear()
