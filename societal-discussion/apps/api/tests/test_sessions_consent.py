from sqlalchemy import select

from src.models import Session

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True, "language": "en"}


async def test_session_without_body_has_no_consent(client):
    res = await client.post("/api/sessions")
    assert res.status_code == 201
    assert res.json()["consent_accepted_at"] is None


async def test_session_with_consent_is_recorded(client, db_session):
    res = await client.post("/api/sessions", json=CONSENT)
    assert res.status_code == 201
    body = res.json()
    assert body["consent_accepted_at"] is not None
    got = await client.get(f"/api/sessions/{body['id']}")
    assert got.json()["consent_accepted_at"] == body["consent_accepted_at"]
    row = (await db_session.execute(select(Session).where(Session.id == body["id"]))).scalar_one()
    assert row.consent_version == "2026-10-23-v1"
    assert row.consent_language == "en"
    assert row.age_confirmed is True


async def test_consent_without_age_confirmation_is_rejected(client):
    res = await client.post("/api/sessions", json={**CONSENT, "age_confirmed": False})
    assert res.status_code == 400


async def test_unknown_language_falls_back_to_finnish(client, db_session):
    body = (await client.post("/api/sessions", json={**CONSENT, "language": "sv"})).json()
    row = (await db_session.execute(select(Session).where(Session.id == body["id"]))).scalar_one()
    assert row.consent_language == "fi"


async def test_conversation_requires_consent(client):
    sid = (await client.post("/api/sessions")).json()["id"]
    res = await client.post("/api/conversations", json={"session_id": sid, "language": "fi"})
    assert res.status_code == 403
    assert res.json()["detail"] == "Consent required"


async def test_conversation_allowed_after_consent(client):
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    res = await client.post("/api/conversations", json={"session_id": sid, "language": "fi"})
    assert res.status_code == 201
    assert "assigned_party" not in res.json()


async def test_test_mode_session_needs_no_consent(client, db_session):
    s = Session(is_test_mode=True)
    db_session.add(s)
    await db_session.flush()
    res = await client.post("/api/conversations", json={"session_id": s.id, "language": "fi"})
    assert res.status_code == 201
