"""Repository for ClassEnrollment model.

Provides CRUD operations for student enrollment history with
eager-loaded relationships to prevent N+1 queries.

Note: ClassEnrollment does NOT support soft deletes (no deleted_at column).
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.class_enrollment import ClassEnrollment
from app.repository.base import BaseRepository


class ClassEnrollmentRepository(BaseRepository[ClassEnrollment]):
    """Repository for student enrollment history management.

    All queries use ``selectinload()`` to eagerly load the related
    student, class, and academic year, preventing N+1 query problems.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing

    Note: ``soft_delete()`` is not supported for enrollments as the
    underlying model has no ``deleted_at`` column. Use ``hard_delete()``
    if removal is required.
    """

    _DEFAULT_OPTIONS = (
        selectinload(ClassEnrollment.student),
        selectinload(ClassEnrollment.class_),
        selectinload(ClassEnrollment.academic_year),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, ClassEnrollment)

    async def get(self, id: str) -> ClassEnrollment | None:  # type: ignore[override]
        """Fetch a single enrollment record with eager-loaded relationships."""
        query = (
            select(self.model)
            .where(self.model.id == id)
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(  # type: ignore[override]
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        school_id: str | None = None,
        order_by: Any | None = None,
    ) -> list[ClassEnrollment]:
        """Fetch multiple enrollment records with eager-loaded relationships."""
        query = select(self.model).options(*self._DEFAULT_OPTIONS)

        if school_id is not None:
            query = query.where(self.model.school_id == school_id)

        if order_by is not None:
            query = query.order_by(order_by)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_student_history(
        self,
        student_id: str,
    ) -> list[ClassEnrollment]:
        """Return the full enrollment history for a student.

        Results are ordered by ``enrolled_at`` descending (most recent first),
        including all statuses (active, promoted, transferred, graduated,
        withdrawn).
        """
        query = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .options(*self._DEFAULT_OPTIONS)
            .order_by(self.model.enrolled_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_current_enrollment(
        self,
        student_id: str,
    ) -> ClassEnrollment | None:
        """Return the current active enrollment for a student.

        Returns the enrollment with ``status = 'active'`` for the given
        student, or ``None`` if the student is not currently enrolled.
        """
        query = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .where(self.model.status == "active")
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def soft_delete(self, id: str) -> None:  # type: ignore[override]
        """Not supported — ClassEnrollment has no ``deleted_at`` column.

        Raises ``AttributeError`` with a clear message.
        """
        raise AttributeError(
            "ClassEnrollment does not support soft deletes. "
            "Use hard_delete() or update status to 'withdrawn' instead."
        )
