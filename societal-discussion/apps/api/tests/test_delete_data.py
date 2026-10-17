from datetime import datetime

from sqlalchemy import func, select

from src.models import Conversation, Message, Session, SurveyResponse


async def _count(db_session, model) -> int:
    return (await db_session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_delete_removes_messages_and_survey_but_keeps_tombstone(client, db_session):
    s = Session(consent_version="t", age_confirmed=True, consent_accepted_at=datetime.now())
    db_session.add(s)
    await db_session.flush()
    c = Conversation(session_id=s.id, assigned_party="rkp", language="fi")
    db_session.add(c)
    await db_session.flush()
    db_session.add(Message(conversation_id=c.id, role="user", content="hei"))
    db_session.add(Message(conversation_id=c.id, role="assistant", content="hei hei"))
    db_session.add(SurveyResponse(session_id=s.id, responses={"detected_bias": 3}))
    await db_session.flush()

    res = await client.delete(f"/api/sessions/{s.id}/data")
    assert res.status_code == 204

    assert await _count(db_session, Message) == 0
    assert await _count(db_session, SurveyResponse) == 0
    assert await _count(db_session, Conversation) == 1
    await db_session.refresh(s)
    assert s.data_deleted_at is not None
    await db_session.refresh(c)
    assert c.assigned_party == "rkp"
    assert c.is_complete is True

    # Idempotent
    res = await client.delete(f"/api/sessions/{s.id}/data")
    assert res.status_code == 204

    # The debrief still answers after deletion (the thank-you page reloads),
    # marked as deleted; the condition stays visible as it was disclosed before.
    res = await client.get(f"/api/sessions/{s.id}/debrief")
    assert res.status_code == 200
    assert res.json()["data_deleted"] is True
    assert res.json()["conversations"][0]["party_display_name"]

    # No new conversation under a tombstone.
    res = await client.post("/api/conversations", json={"session_id": s.id, "starter_topic": None, "language": "fi"})
    assert res.status_code == 403
    assert res.json()["detail"] == "Session data deleted"


async def test_delete_unknown_session_is_404(client):
    res = await client.delete("/api/sessions/nope/data")
    assert res.status_code == 404
