from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

settings = get_settings()


def make_engine(url: str, **kwargs) -> AsyncEngine:
    """Create the engine. For an SQLite file: WAL mode (readers never wait for
    a writer) and a 30 s busy timeout, so concurrent participants queue for
    the write lock instead of failing."""
    is_sqlite = url.startswith("sqlite")
    if is_sqlite:
        kwargs.setdefault("connect_args", {}).setdefault("timeout", 30)
    eng = create_async_engine(url, **kwargs)
    if is_sqlite and ":memory:" not in url:

        @event.listens_for(eng.sync_engine, "connect")
        def _wal(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return eng


engine = make_engine(settings.database_url, echo=settings.debug)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
