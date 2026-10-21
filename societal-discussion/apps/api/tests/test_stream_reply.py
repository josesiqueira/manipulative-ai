"""Streamed replies: the phone gets the text in pieces, then 'done' once both
messages are saved; an empty stream falls back to one plain call; a model
failure is an 'error' event and nothing is stored."""
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from src.database import get_sessionmaker
from src.main import app
from src.models import Message
from src.routers import conversations as conversations_router

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


class _Provider:
    def __init__(self, pieces, plain="", fail=False):
        self.pieces, self.plain, self.fail = pieces, plain, fail
        self.last_token_count = 0

    def generate_streaming(self, messages, model, max_tokens=1024, temperature=0.1):
        if self.fail:
            raise RuntimeError("model down")
        for p in self.pieces:
            yield p
        self.last_token_count = 42

    async def generate(self, messages, model, max_tokens=1024, temperature=0.1):
        return self.plain, 9


def _events(body: str) -> list[tuple[str, dict]]:
    out = []
    for block in body.split("\n\n"):
        lines = [line for line in block.splitlines() if line and not line.startswith(":")]
        if not lines:
            continue
        name = lines[0].removeprefix("event: ")
        out.append((name, json.loads(lines[1].removeprefix("data: "))))
    return out


async def _setup(client, db_session, monkeypatch, provider):
    from src.services.llm_client import PreparedReply

    async def prepare(db, conversation, user_message):
        return PreparedReply(provider, "gpt-6-astra", [])

    monkeypatch.setattr(conversations_router, "prepare_reply", prepare)
    app.dependency_overrides[get_sessionmaker] = lambda: async_sessionmaker(db_session.bind, expire_on_commit=False)
    sid = (await client.post("/api/sessions", json=CONSENT)).json()["id"]
    return (await client.post("/api/conversations", json={"session_id": sid})).json()["id"]


async def test_reply_streams_in_pieces_and_is_saved(client, db_session, monkeypatch):
    cid = await _setup(client, db_session, monkeypatch, _Provider(["Hyvä ", "kysymys. ", "Kerron lisää."]))
    res = await client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "moi", "input_mode": "spoken"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = _events(res.text)
    assert [e[0] for e in events] == ["delta", "delta", "delta", "done"]
    assert "".join(e[1]["text"] for e in events[:3]) == "Hyvä kysymys. Kerron lisää."
    assert events[-1][1]["content"] == "Hyvä kysymys. Kerron lisää."
    rows = (await db_session.execute(select(Message).order_by(Message.created_at))).scalars().all()
    assert [(m.role, m.input_mode, m.token_count) for m in rows] == [("user", "spoken", None), ("assistant", "typed", 42)]
    assert rows[1].model_name == "gpt-6-astra"


async def test_empty_stream_falls_back_to_a_plain_call(client, db_session, monkeypatch):
    cid = await _setup(client, db_session, monkeypatch, _Provider([], plain="Vastaus."))
    events = _events((await client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "moi"})).text)
    assert events == [("delta", {"text": "Vastaus."}), ("done", events[-1][1])]
    assert events[-1][1]["content"] == "Vastaus."


async def test_model_failure_is_an_error_event_and_nothing_is_stored(client, db_session, monkeypatch):
    cid = await _setup(client, db_session, monkeypatch, _Provider([], fail=True))
    events = _events((await client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "moi"})).text)
    assert [e[0] for e in events] == ["error"]
    assert (await db_session.execute(select(Message))).scalars().all() == []


async def test_stream_refuses_a_finished_conversation_before_any_model_call(client, db_session, monkeypatch):
    cid = await _setup(client, db_session, monkeypatch, _Provider([], fail=True))
    await client.put(f"/api/conversations/{cid}/end")
    res = await client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "moi"})
    assert res.status_code == 400
