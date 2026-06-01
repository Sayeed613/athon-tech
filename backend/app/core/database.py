"""Database engine and session management.

Provides async SQLAlchemy engine, session factory, and helper
dependencies for the FastAPI application.

All engine parameters come from Settings so they can be tuned
per-environment without code changes.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_pre_ping=True,
    echo=settings.app_debug,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields an async database session.

    Commits on success, rolls back on exception. The session is
    closed automatically by the context manager.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_db_connection() -> dict:
    """Verify database connectivity.

    Runs a simple `SELECT 1` query and returns a status dict.

    Returns:
        dict with keys:
            - status: "connected" or "disconnected"
            - error: error message if disconnected, None otherwise
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "connected", "error": None}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}


__all__ = [
    "engine",
    "async_session_factory",
    "get_db",
    "check_db_connection",
]
