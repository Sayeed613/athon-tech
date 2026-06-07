"""Homework repository — data access for homework assignments.

Provides school-scoped CRUD plus specialised queries for class-level
and teacher-level homework views with eager-loaded relationships.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.homework import Homework
from app.models.teacher import Teacher
from app.repository.base import BaseRepository


class HomeworkRepository(BaseRepository[Homework]):
    """Repository for Homework records.

    All queries are school-scoped and respect the soft-delete filter.
    """

    _DEFAULT_OPTIONS = (
        selectinload(Homework.teacher).selectinload(Teacher.user),
        selectinload(Homework.class_),
        selectinload(Homework.subject),
        selectinload(Homework.academic_term),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Homework)

    async def get_by_class(
        self,
        class_id: str,
        school_id: str | None = None,
        academic_term_id: str | None = None,
        published_only: bool = True,
    ) -> list[Homework]:
        """Fetch homework assignments for a class.

        Args:
            class_id: UUID of the class.
            school_id: Optional school scope filter.
            academic_term_id: Optional term filter.
            published_only: If True (default), only return published homeworks.

        Returns:
            A list of Homework records ordered by due_date descending.
        """
        query = (
            self._active_query()
            .where(Homework.class_id == class_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = self._school_scope(query, school_id)

        if academic_term_id is not None:
            query = query.where(Homework.academic_term_id == academic_term_id)

        if published_only:
            query = query.where(Homework.is_published.is_(True))

        query = query.order_by(Homework.due_date.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_teacher(
        self,
        teacher_id: str,
        school_id: str | None = None,
        academic_term_id: str | None = None,
    ) -> list[Homework]:
        """Fetch homework assignments created by a teacher.

        Args:
            teacher_id: UUID of the teacher.
            school_id: Optional school scope filter.
            academic_term_id: Optional term filter.

        Returns:
            A list of Homework records ordered by created_at descending.
        """
        query = (
            self._active_query()
            .where(Homework.teacher_id == teacher_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = self._school_scope(query, school_id)

        if academic_term_id is not None:
            query = query.where(Homework.academic_term_id == academic_term_id)

        query = query.order_by(Homework.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_with_questions(
        self,
        homework_id: str,
    ) -> Homework | None:
        """Fetch a homework with its questions eager-loaded."""
        from app.models.homework_question import HomeworkQuestion

        query = (
            self._active_query()
            .where(Homework.id == homework_id)
            .options(
                selectinload(Homework.questions),
                *self._DEFAULT_OPTIONS,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_published_for_student_class(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
    ) -> list[Homework]:
        """Fetch published homework for a student's class.

        Students can only see published (not draft) homework.
        """
        return await self.get_by_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
            published_only=True,
        )
