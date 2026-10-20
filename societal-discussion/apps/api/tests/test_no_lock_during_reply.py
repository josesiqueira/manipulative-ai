"""A slow model reply must not hold the SQLite write lock: other participants'
requests (consent, new conversations, surveys) have to go through meanwhile."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.database import Base, get_db, make_engine
from src.main import app
from src.models import LLMConfig, Message, Session
from src.routers import conversations as conversations_router
from httpx import ASGITransport, AsyncClient

CONSENT = {"consent_version": "2026-10-23-v1", "age_confirmed": True}


async def test_another_write_succeeds_while_a_reply_is_generated(tmp_path):
    url = f"sqlite+aiosqlite:///{tmp_path / 'lock.db'}"
    engine_a = make_engine(url, connect_args={"timeout": 1})
    engine_b = make_engine(url, connect_args={"timeout": 1})
    async with engine_a.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker_a = async_sessionmaker(engine_a, class_=AsyncSession, expire_on_commit=False)
    maker_b = async_sessionmaker(engine_b, class_=AsyncSession, expire_on_commit=False)

    async def real_db():
        async with maker_a() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    other_write = {}

    async def slow_reply(db, conversation, user_message):
        # Like the real client: read the model settings through the same session...
        await db.execute(select(LLMConfig))
        # ...while another participant writes through another connection.
        async with maker_b() as other:
            other.add(Session(consent_version="other", age_confirmed=True))
            await other.commit()
        other_write["ok"] = True
        return "vastaus", 7, "fake-model"

    app.dependency_overrides[get_db] = real_db
    original = conversations_router.generate_response
    conversations_router.generate_response = slow_reply
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            sid = (await c.post("/api/sessions", json=CONSENT)).json()["id"]
            cid = (await c.post("/api/conversations", json={"session_id": sid})).json()["id"]
            res = await c.post(f"/api/conversations/{cid}/messages", json={"content": "moi"})
        assert res.status_code == 200
        assert other_write.get("ok") is True
        async with maker_b() as s:
            rows = (await s.execute(select(Message).order_by(Message.created_at))).scalars().all()
            assert [m.role for m in rows] == ["user", "assistant"]
            assert rows[0].created_at <= rows[1].created_at
    finally:
        conversations_router.generate_response = original
        app.dependency_overrides.clear()
        await engine_a.dispose()
        await engine_b.dispose()
