"""Alembic migration environment — async SQLAlchemy + PostgreSQL (Supabase).

This env.py is configured for async migrations using the application's
existing engine configuration from app.core.database.

Key design decisions:
- Reads DATABASE_URL from app.core.config.settings (not hardcoded)
- Uses async SQLAlchemy engine with run_async()
- The existing database schema is managed via the 6 SQL files in database/
- Alembic manages *future* schema changes only
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

# Alembic Config object
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate support — populated from ORM models
# When all models are created, uncomment the import below to enable
# autogenerate detection of schema drifts.
from app.models import Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just the URL and not an Engine.
    Calls to context.execute() emit the SQL to the script output.
    """
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Helper to run migrations against a synchronous-style connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = create_async_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Wraps the async migration runner for Alembic's synchronous entry point.
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
