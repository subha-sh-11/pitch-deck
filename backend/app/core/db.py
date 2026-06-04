"""SQLAlchemy engines and sessions.

- Async engine + `get_db` dependency for FastAPI request handlers.
- Sync engine + `session_scope` for Celery workers (which can't drive the async engine).
"""
from __future__ import annotations

from collections.abc import AsyncGenerator, Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,  # SQL echo is too noisy; pipeline/request logging covers visibility
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session, ensuring it is closed after the request."""
    async with SessionLocal() as session:
        yield session


# ─── Sync engine / session (Celery workers) ───

sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    future=True,
)

SyncSessionLocal: sessionmaker[Session] = sessionmaker(
    bind=sync_engine, expire_on_commit=False, autoflush=False
)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional scope for worker code: commits on success, rolls back on error."""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
