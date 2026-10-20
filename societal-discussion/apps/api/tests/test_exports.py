import csv
import io
from datetime import datetime
from zoneinfo import ZoneInfo

from src.models import Conversation, Message, Session, SurveyResponse

HEADERS = {"X-Admin-Password": "admin"}
HELSINKI = ZoneInfo("Europe/Helsinki")


async def _data(db_session):
    s = Session(consent_version="t", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    rows = [
        ("sdp_populist", datetime(2026, 10, 23, 16, 5, tzinfo=HELSINKI)),
        ("sdp_antipopulist", datetime(2026, 10, 23, 16, 15, tzinfo=HELSINKI)),
        ("kokoomus", datetime(2026, 5, 20, 12, 0, tzinfo=HELSINKI)),  # former standard id
    ]
    for party, started in rows:
        c = Conversation(session_id=s.id, assigned_party=party, language="fi", started_at=started)
        db_session.add(c)
        await db_session.flush()
        db_session.add(Message(conversation_id=c.id, role="user", content="moi", created_at=started))
        db_session.add(Message(conversation_id=c.id, role="assistant", content="hei", model_name="gpt-6-astra", created_at=started))
    db_session.add(SurveyResponse(session_id=s.id, responses={"detected_bias": 3}))
    await db_session.flush()
    return s


def _csv(res):
    return list(csv.DictReader(io.StringIO(res.text)))


async def test_conversation_export_has_framing_and_the_date_filters_work(client, db_session):
    await _data(db_session)
    rows = _csv(await client.get("/api/admin/export", params={"format": "csv"}, headers=HEADERS))
    assert [(r["assigned_party"], r["base_party"], r["framing"]) for r in rows] == [
        ("kokoomus", "kokoomus", ""),
        ("sdp_populist", "sdp", "populist"),
        ("sdp_antipopulist", "sdp", "antipopulist"),
    ]
    assert rows[1]["models_used"] == "gpt-6-astra"
    after = _csv(await client.get("/api/admin/export", params={"format": "csv", "date_from": "2026-10-23"}, headers=HEADERS))
    assert {r["assigned_party"] for r in after} == {"sdp_populist", "sdp_antipopulist"}
    before = _csv(await client.get("/api/admin/export", params={"format": "csv", "date_to": "2026-06-01"}, headers=HEADERS))
    assert [r["assigned_party"] for r in before] == ["kokoomus"]


async def test_message_and_survey_exports_carry_the_conditions(client, db_session):
    await _data(db_session)
    msgs = _csv(await client.get("/api/admin/export", params={"format": "messages-csv"}, headers=HEADERS))
    assert {(r["assigned_party"], r["framing"]) for r in msgs} == {
        ("kokoomus", ""), ("sdp_populist", "populist"), ("sdp_antipopulist", "antipopulist"),
    }
    surveys = _csv(await client.get("/api/admin/export/surveys", params={"format": "csv"}, headers=HEADERS))
    assert surveys[0]["conditions"] == "kokoomus;sdp_populist;sdp_antipopulist"
    assert surveys[0]["framings"] == ";populist;antipopulist"
    assert surveys[0]["detected_bias"] == "3"
