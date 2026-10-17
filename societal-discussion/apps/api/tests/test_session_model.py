from src.models import Session


async def test_new_session_has_no_consent_by_default(db_session):
    s = Session()
    db_session.add(s)
    await db_session.flush()
    await db_session.refresh(s)
    assert s.consent_accepted_at is None
    assert s.consent_version is None
    assert s.consent_language is None
    assert s.age_confirmed is False
    assert s.data_deleted_at is None
