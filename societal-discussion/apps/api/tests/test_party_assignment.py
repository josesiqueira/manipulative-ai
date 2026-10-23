from src.models import Conversation, Session
from src.services.party_assignment import assign_party, get_global_party_counts
from src.services.party_grounding import ALL_PARTIES


async def _new_session(db, is_test_mode=False) -> Session:
    session = Session(is_test_mode=is_test_mode)
    db.add(session)
    await db.commit()
    return session


async def _assign_and_save(db, session, is_test_mode=False) -> str:
    party = await assign_party(db, session.id)
    db.add(Conversation(session_id=session.id, assigned_party=party, is_test_mode=is_test_mode))
    await db.commit()
    return party


async def test_eighteen_conversations_in_one_session_visit_every_condition_once(db_session):
    session = await _new_session(db_session)
    seen = [await _assign_and_save(db_session, session) for _ in range(18)]
    assert sorted(seen) == sorted(ALL_PARTIES)
    assert len(set(seen)) == 18


async def test_the_nineteenth_conversation_starts_a_new_round(db_session):
    session = await _new_session(db_session)
    for _ in range(18):
        await _assign_and_save(db_session, session)
    again = await assign_party(db_session, session.id)
    assert again in ALL_PARTIES


async def test_no_repeat_is_per_session(db_session):
    first = await _new_session(db_session)
    second = await _new_session(db_session)
    used_in_first = {await _assign_and_save(db_session, first) for _ in range(17)}
    # The second session still has the whole pool.
    picks = {await assign_party(db_session, second.id) for _ in range(40)}
    assert picks & used_in_first


async def test_test_mode_conversations_do_not_count(db_session):
    session = await _new_session(db_session, is_test_mode=True)
    for party in ALL_PARTIES:
        db_session.add(Conversation(session_id=session.id, assigned_party=party, is_test_mode=True))
    await db_session.commit()
    counts = await get_global_party_counts(db_session)
    assert set(counts) == set(ALL_PARTIES)
    assert sum(counts.values()) == 0
    # A test-mode row does not block the party for the session either.
    assert await assign_party(db_session, session.id) in ALL_PARTIES


async def test_active_parties_limits_assignment_to_their_eight_conditions(db_session, monkeypatch):
    from src.config import get_settings

    monkeypatch.setattr(get_settings(), "active_parties", "perussuomalaiset, vihreat,kokoomus,sdp")
    allowed = {
        f"{p}_{f}" for p in ("perussuomalaiset", "vihreat", "kokoomus", "sdp") for f in ("populist", "antipopulist")
    }
    session = await _new_session(db_session)
    seen = [await _assign_and_save(db_session, session) for _ in range(8)]
    assert set(seen) == allowed and len(seen) == 8
    # The ninth starts a new round, still inside the eight.
    assert {await assign_party(db_session, session.id) for _ in range(30)} <= allowed
