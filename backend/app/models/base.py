"""SQLAlchemy DeclarativeBase and common mixins for all Athon models.

Provides:
    - Base: DeclarativeBase for all ORM models
    - TimestampMixin: created_at / updated_at columns
    - SoftDeleteMixin: deleted_at column
"""

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all Athon ORM models."""
    pass


class TimestampMixin:
    """Adds created_at and updated_at timestamp columns.

    created_at: Server DEFAULT now() on INSERT.
    updated_at: Server DEFAULT now() on INSERT;
                 the database trigger (trg_{table}_updated) sets
                 updated_at = now() on every UPDATE.
    onupdate is provided as a Python-level safety net in case
    the DB trigger is bypassed (e.g., raw SQL, bulk operations).
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Adds deleted_at column for soft-delete support.

    A NULL deleted_at means the record is active.
    A non-NULL deleted_at timestamp means the record is logically deleted.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
