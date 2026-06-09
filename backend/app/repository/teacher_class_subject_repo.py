"""Repository for TeacherClassSubject model.

Provides CRUD operations for teacher ↔ class ↔ subject mappings
with eager-loaded relationships to prevent N+1 queries.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.teacher_class_subject import TeacherClassSubject
from app.repository.base import BaseRepository


class TeacherClassSubjectRepository(BaseRepository[TeacherClassSubject]):
    """Repository for teacher-class-subject assignment management.

    All queries use ``selectinload()`` to eagerly load the related
    teacher, class, subject, and academic term, preventing N+1
    query problems when iterating over assignments.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    _DEFAULT_OPTIONS = (
        selectinload(TeacherClassSubject.teacher),
        selectinload(TeacherClassSubject.class_),
        selectinload(TeacherClassSubject.subject),
        selectinload(TeacherClassSubject.academic_term),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TeacherClassSubject)

    async def get(self, id: str) -> TeacherClassSubject | None:  # type: ignore[override]
        """Fetch a single assignment with all related entities eager-loaded."""
        query = (
            select(self.model)
            .where(self.model.id == id)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_class_and_term(
        self,
        class_id: str,
        academic_term_id: str,
    ) -> list[TeacherClassSubject]:
        """Return all TCS assignments for a class in a given term.

        Includes eager-loaded relationships and filters out soft-deleted
        records. Used to resolve which subjects are taught to a class.
        """
        query = (
            select(self.model)
            .where(self.model.class_id == class_id)
            .where(self.model.academic_term_id == academic_term_id)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_teacher_and_term(
        self,
        teacher_id: str,
        academic_term_id: str,
    ) -> list[TeacherClassSubject]:
        """Fetch assignments for a specific teacher in a specific term."""
        query = (
            select(self.model)
            .where(self.model.teacher_id == teacher_id)
            .where(self.model.academic_term_id == academic_term_id)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_multi(  # type: ignore[override]
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        school_id: str | None = None,
        order_by: Any | None = None,
    ) -> list[TeacherClassSubject]:
        """Fetch multiple assignments with all related entities eager-loaded."""
        query = (
            select(self.model)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = query.where(self.model.school_id == school_id)

        if order_by is not None:
            query = query.order_by(order_by)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())
