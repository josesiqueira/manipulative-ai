import csv
import io

from src.models import Conversation, Message, Session

HEADERS = {"X-Admin-Password": "admin"}


async def test_lookup_by_code_finds_the_session(client, db_session):
    s = Session(consent_version="2026-10-23-v1", consent_language="fi", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    code = f"{s.id[:4]}-{s.id[4:8]}".upper()

    res = await client.get(f"/api/admin/sessions/by-code/{code}", headers=HEADERS)
    assert res.status_code == 200
    body = res.json()
    assert [x["id"] for x in body] == [s.id]
    assert body[0]["session_code"] == code
    assert body[0]["consent_version"] == "2026-10-23-v1"
    assert body[0]["consent_language"] == "fi"
    assert body[0]["age_confirmed"] is True
    assert body[0]["data_deleted_at"] is None


async def test_lookup_by_bad_code_is_400(client):
    res = await client.get("/api/admin/sessions/by-code/zzzz", headers=HEADERS)
    assert res.status_code == 400


async def test_lookup_requires_admin(client):
    res = await client.get("/api/admin/sessions/by-code/3f2a9c11")
    assert res.status_code == 401


async def test_export_csv_has_consent_columns(client, db_session):
    s = Session(consent_version="2026-10-23-v1", consent_language="en", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    db_session.add(Conversation(session_id=s.id, assigned_party="sdp", language="fi"))
    await db_session.flush()

    res = await client.get("/api/admin/export?format=csv", headers=HEADERS)
    assert res.status_code == 200
    rows = list(csv.DictReader(io.StringIO(res.text)))
    assert rows[0]["session_code"] == f"{s.id[:4]}-{s.id[4:8]}".upper()
    assert rows[0]["consent_version"] == "2026-10-23-v1"
    assert rows[0]["consent_language"] == "en"
    assert rows[0]["age_confirmed"] == "True"
    assert rows[0]["data_deleted_at"] == ""


async def test_message_export_has_input_mode_and_model(client, db_session):
    s = Session(consent_version="t", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    c = Conversation(session_id=s.id, assigned_party="rkp", language="fi")
    db_session.add(c)
    await db_session.flush()
    db_session.add(Message(conversation_id=c.id, role="user", content="hei", input_mode="spoken"))
    db_session.add(Message(conversation_id=c.id, role="assistant", content="hei hei", model_name="m-1"))
    await db_session.flush()

    res = await client.get("/api/admin/export?format=messages-csv", headers=HEADERS)
    rows = list(csv.DictReader(io.StringIO(res.text)))
    assert [(r["role"], r["input_mode"], r["model_name"]) for r in rows] == [
        ("user", "spoken", ""),
        ("assistant", "typed", "m-1"),
    ]
