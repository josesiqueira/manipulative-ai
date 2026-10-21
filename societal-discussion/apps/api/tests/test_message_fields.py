from sqlalchemy import select

from src.models import Message, Session
from src.routers import conversations as conversations_router

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


async def _fake_prepare(db, conversation, user_message):
    return None


async def _fake_generate(prepared):
    return "vastaus", 7, "fake-model-1"


def _fake_model(monkeypatch):
    monkeypatch.setattr(conversations_router, "prepare_reply", _fake_prepare)
    monkeypatch.setattr(conversations_router, "generate_reply", _fake_generate)


async def test_spoken_message_and_model_name_are_stored(client, db_session, monkeypatch):
    _fake_model(monkeypatch)
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    cid = (await client.post("/api/conversations", json={"session_id": sid})).json()["id"]

    res = await client.post(
        f"/api/conversations/{cid}/messages", json={"content": "moi", "input_mode": "spoken"}
    )
    assert res.status_code == 200
    assert res.json()["content"] == "vastaus"

    rows = (await db_session.execute(select(Message).order_by(Message.created_at))).scalars().all()
    assert [(m.role, m.input_mode, m.model_name) for m in rows] == [
        ("user", "spoken", None),
        ("assistant", "typed", "fake-model-1"),
    ]


async def test_input_mode_defaults_to_typed_and_rejects_unknown_values(client, db_session, monkeypatch):
    _fake_model(monkeypatch)
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    cid = (await client.post("/api/conversations", json={"session_id": sid})).json()["id"]
    await client.post(f"/api/conversations/{cid}/messages", json={"content": "a"})
    await client.post(f"/api/conversations/{cid}/messages", json={"content": "b", "input_mode": "sung"})
    rows = (await db_session.execute(select(Message).where(Message.role == "user"))).scalars().all()
    assert {m.input_mode for m in rows} == {"typed"}
    assert isinstance((await db_session.execute(select(Session))).scalars().first(), Session)
