"""The survey closes the session (the debrief that follows names the party),
a survey is taken once, and the misuse limits answer before any model call."""
from sqlalchemy import select

from src.models import Conversation
from src.routers import conversations as conversations_router

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


async def _no_model(*_args, **_kwargs):
    raise AssertionError("the model must not be called")


async def _start(client):
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    cid = (await client.post("/api/conversations", json={"session_id": sid})).json()["id"]
    return sid, cid


async def test_survey_closes_the_session(client, db_session, monkeypatch):
    monkeypatch.setattr(conversations_router, "generate_reply", _no_model)
    sid, cid = await _start(client)
    assert (await client.post("/api/survey", json={"session_id": sid, "responses": {"a": 1}})).status_code == 201
    conv = (await db_session.execute(select(Conversation).where(Conversation.id == cid))).scalar_one()
    assert conv.is_complete is True
    assert (await client.post(f"/api/conversations/{cid}/messages", json={"content": "moi"})).status_code == 400
    res = await client.post("/api/conversations", json={"session_id": sid})
    assert res.status_code == 403
    again = await client.post("/api/survey", json={"session_id": sid, "responses": {"a": 2}})
    assert again.status_code == 409


async def test_survey_needs_consent(client):
    sid = (await client.post("/api/sessions")).json()["id"]
    res = await client.post("/api/survey", json={"session_id": sid, "responses": {}})
    assert res.status_code == 403


async def test_message_length_and_empty_messages_are_refused(client, monkeypatch):
    monkeypatch.setattr(conversations_router, "prepare_reply", _no_model)
    _sid, cid = await _start(client)
    long = "a" * (conversations_router.MAX_MESSAGE_CHARS + 1)
    assert (await client.post(f"/api/conversations/{cid}/messages", json={"content": long})).status_code == 422
    assert (await client.post(f"/api/conversations/{cid}/messages", json={"content": "   "})).status_code == 422


async def test_conversation_cap(client, monkeypatch):
    monkeypatch.setattr(conversations_router, "MAX_CONVERSATIONS_PER_SESSION", 2)
    sid, _cid = await _start(client)
    assert (await client.post("/api/conversations", json={"session_id": sid})).status_code == 201
    assert (await client.post("/api/conversations", json={"session_id": sid})).status_code == 429
