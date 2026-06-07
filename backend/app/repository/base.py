"""Generic base repository providing CRUD operations for all Athon models.

Features:
    - Async SQLAlchemy 2.0 queries
    - School-scoped queries (tenant isolation)
    - Soft-delete aware (automatically filters out logically deleted records)
    - Pagination support via skip/limit
    - Type-safe generic implementation
"""

from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.common.pagination import Page

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    """Generic repository providing standard CRUD operations.

    Usage::

        class UserRepository(BaseRepository[User]):
            def __init__(self, db: AsyncSession):
                super().__init__(db, User)

    All queries automatically:
        - Filter out soft-deleted records (WHERE deleted_at IS NULL)
        - Support school-scoped filtering via ``_school_scope()``
        - Support pagination via ``get_multi()``
    """

    def __init__(self, db: AsyncSession, model: type[ModelT]) -> None:
        self.db = db
        self.model = model

    # ── Query Builders ──────────────────────────────────────────

    def _active_query(self) -> Select:
        """Return a base SELECT query that excludes soft-deleted records.

        If the model does not have a ``deleted_at`` column (e.g.
        ClassEnrollment), the filter is omitted.
        """
        q = select(self.model)
        if hasattr(self.model, "deleted_at"):
            q = q.where(self.model.deleted_at.is_(None))  # type: ignore[union-attr]
        return q

    def _school_scope(self, query: Select, school_id: Any) -> Select:
        """Apply school-scoped filtering to a query.

        Requires the model to have a ``school_id`` column.
        Raises ``AttributeError`` if the model is not tenant-scoped.
        """
        return query.where(self.model.school_id == school_id)  # type: ignore[union-attr]

    # ── CRUD Operations ─────────────────────────────────────────

    async def create(self, **kwargs: Any) -> ModelT:
        """Create and return a new record.

        All keyword arguments are passed directly to the model constructor.
        The record is added to the session but **not** committed — the
        caller (or the ``UnitOfWork``) is responsible for committing.
        """
        instance = self.model(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get(self, id: Any) -> ModelT | None:
        """Fetch a single record by primary key.

        Returns ``None`` if the record is not found or is soft-deleted.
        """
        query = self._active_query().where(self.model.id == id)  # type: ignore[union-attr]
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        school_id: Any | None = None,
        order_by: Any | None = None,
    ) -> Sequence[ModelT]:
        """Fetch multiple records with optional school scoping and pagination.

        Args:
            skip: Number of records to skip (for offset pagination).
            limit: Maximum number of records to return.
            school_id: If provided, filter to this school (tenant isolation).
            order_by: Optional SQLAlchemy column expression for ordering.

        Returns:
            A list of model instances (may be empty).
        """
        query = self._active_query()

        if school_id is not None:
            query = self._school_scope(query, school_id)

        if order_by is not None:
            query = query.order_by(order_by)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_multi_paginated(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
        school_id: Any | None = None,
        order_by: Any | None = None,
    ) -> Page[ModelT]:
        """Fetch multiple records with full pagination metadata.

        Returns a ``Page`` object containing the items, total count, and
        pagination metadata (page, page_size, pages).
        """
        total = await self.count(school_id=school_id)
        items = await self.get_multi(
            skip=(page - 1) * page_size,
            limit=page_size,
            school_id=school_id,
            order_by=order_by,
        )
        return Page(
            items=list(items),
            total=total,
            page=page,
            page_size=page_size,
        )

    async def update(self, id: Any, **kwargs: Any) -> ModelT | None:
        """Update a record by primary key with the given fields.

        Only the fields provided as keyword arguments are updated.
        Returns the updated record, or ``None`` if not found.

        The update is flushed to the database but **not** committed.
        """
        # Ensure the record exists and is not soft-deleted
        instance = await self.get(id)
        if instance is None:
            return None

        # Apply updates
        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)

        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def soft_delete(self, id: Any) -> ModelT | None:
        """Soft-delete a record by setting ``deleted_at``.

        Returns the updated record, or ``None`` if not found.
        If the model does not support soft deletes, raises ``AttributeError``.
        """
        if not hasattr(self.model, "deleted_at"):
            raise AttributeError(
                f"{self.model.__name__} does not support soft deletes"
            )

        instance = await self.get(id)
        if instance is None:
            return None

        from datetime import datetime, timezone

        instance.deleted_at = datetime.now(timezone.utc)  # type: ignore[union-attr]
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def hard_delete(self, id: Any) -> bool:
        """Permanently delete a record from the database.

        Returns ``True`` if a record was deleted, ``False`` if not found.
        Use with caution — in most cases ``soft_delete()`` is preferred.
        """
        instance = await self.get(id)
        if instance is None:
            return False

        await self.db.delete(instance)
        await self.db.flush()
        return True

    async def count(
        self,
        *,
        school_id: Any | None = None,
    ) -> int:
        """Count records, optionally filtered by school.

        Excludes soft-deleted records automatically.
        """
        query = self._active_query()

        if school_id is not None:
            query = self._school_scope(query, school_id)

        count_query = select(func.count()).select_from(query.subquery())
        result = await self.db.execute(count_query)
        return result.scalar_one()
