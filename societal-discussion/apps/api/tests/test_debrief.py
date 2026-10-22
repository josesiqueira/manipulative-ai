from sqlalchemy import select

from src.models import Conversation, Message, Session, SurveyResponse


async def _consented_session(db_session, parties: list[str], empty: tuple[str, ...] = ()) -> Session:
    s = Session(consent_version="t", age_confirmed=True)
    db_session.add(s)
    await db_session.flush()
    for p in parties:
        c = Conversation(session_id=s.id, assigned_party=p, language="fi")
        db_session.add(c)
        await db_session.flush()
        if p not in empty:
            db_session.add(Message(conversation_id=c.id, role="user", content="moi"))
            await db_session.flush()
    return s


async def test_debrief_is_forbidden_before_survey(client, db_session):
    s = await _consented_session(db_session, ["sdp"])
    res = await client.get(f"/api/sessions/{s.id}/debrief")
    assert res.status_code == 403
    assert "sdp" not in res.text


async def test_debrief_lists_every_conversation_with_messages_after_survey(client, db_session):
    # The chat page for vihreat_populist was opened but nothing was sent:
    # that party was never shown, so the debrief does not name it.
    s = await _consented_session(
        db_session,
        ["kokoomus", "sdp_populist", "vihreat_populist", "rkp_antipopulist"],
        empty=("vihreat_populist",),
    )
    db_session.add(SurveyResponse(session_id=s.id, responses={}))
    await db_session.flush()
    res = await client.get(f"/api/sessions/{s.id}/debrief")
    assert res.status_code == 200
    body = res.json()
    assert body["session_code"] == f"{s.id[:4].upper()}-{s.id[4:8].upper()}"
    assert body["data_deleted"] is False
    names = [(c["party_display_name"], c["is_populist"], c["framing"]) for c in body["conversations"]]
    # "kokoomus" is a former standard id (earlier data): no framing.
    assert names == [("Kokoomus", False, None), ("SDP", True, "populist"), ("RKP", False, "antipopulist")]


async def test_debrief_unknown_session_is_404(client):
    res = await client.get("/api/sessions/nope/debrief")
    assert res.status_code == 404


async def test_debrief_lists_the_models_that_answered_in_order_of_first_use(client, db_session):
    s = await _consented_session(db_session, ["sdp_populist", "rkp_antipopulist"])
    s.consent_version = "2026-10-23-v1+anthropic"
    conversations = sorted(
        (await db_session.execute(select(Conversation).where(Conversation.session_id == s.id))).scalars(),
        key=lambda c: c.assigned_party,
    )
    for conversation, model in zip(conversations, ["claude-sonnet-5-5", "gpt-6-astra"]):
        db_session.add(Message(conversation_id=conversation.id, role="assistant", content="vastaus", model_name=model))
        await db_session.flush()
    db_session.add(Message(conversation_id=conversations[0].id, role="assistant", content="toinen", model_name="claude-sonnet-5-5"))
    db_session.add(SurveyResponse(session_id=s.id, responses={}))
    await db_session.flush()
    body = (await client.get(f"/api/sessions/{s.id}/debrief")).json()
    assert body["models"] == [
        {"provider": "anthropic", "model": "claude-sonnet-5-5", "model_name": "Claude Sonnet 5.5"},
        {"provider": "openai", "model": "gpt-6-astra", "model_name": "GPT-6 Astra"},
    ]


async def test_debrief_after_deletion_falls_back_to_the_consented_provider(client, db_session):
    s = await _consented_session(db_session, ["sdp_populist"])
    s.consent_version = "2026-10-23-v1+gptlab"
    db_session.add(SurveyResponse(session_id=s.id, responses={}))
    await db_session.flush()
    assert (await client.delete(f"/api/sessions/{s.id}/data")).status_code == 204
    body = (await client.get(f"/api/sessions/{s.id}/debrief")).json()
    assert body["models"] == [{"provider": "gptlab", "model": "", "model_name": ""}]
