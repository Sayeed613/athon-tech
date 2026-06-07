"""Teacher repository — data access for teacher profiles.

All queries are school-scoped and respect soft-delete filtering
inherited from BaseRepository.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academic_class import Class as AcademicClass
from app.models.academic_term import AcademicTerm
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.user import User
from app.repository.base import BaseRepository


class TeacherRepository(BaseRepository[Teacher]):
    """Repository for Teacher records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Teacher)

    async def get_by_user_id(self, user_id: str) -> Teacher | None:
        """Fetch a teacher record by the associated user_id."""
        query = self._active_query().where(Teacher.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_user(self, teacher_id: str) -> Teacher | None:
        """Fetch a teacher with the associated User eagerly loaded."""
        query = (
            self._active_query()
            .where(Teacher.id == teacher_id)
            .options(selectinload(Teacher.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_assignments(self, teacher_id: str) -> Teacher | None:
        """Fetch a teacher with assignments and the user eagerly loaded."""
        query = (
            self._active_query()
            .where(Teacher.id == teacher_id)
            .options(
                selectinload(Teacher.user),
                selectinload(Teacher.teacher_class_subjects),
                selectinload(Teacher.teacher_class_subjects).selectinload(
                    TeacherClassSubject.class_
                ),
                selectinload(Teacher.teacher_class_subjects).selectinload(
                    TeacherClassSubject.subject
                ),
                selectinload(Teacher.teacher_class_subjects).selectinload(
                    TeacherClassSubject.academic_term
                ),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def search_by_name(
        self,
        school_id: str,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Teacher], int]:
        """Search teachers by first/last name or employee_code within a school.

        Always joins with User for ordering. Returns a tuple of
        (teachers_list, total_count).
        """
        import logging
        logger = logging.getLogger("athon")

        from sqlalchemy import func as sa_func

        # Base query with mandatory User join for sorting
        base_query = (
            self._active_query()
            .join(Teacher.user)
            .where(Teacher.school_id == school_id)
        )

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                User.first_name.ilike(pattern)
                | User.last_name.ilike(pattern)
                | Teacher.employee_code.ilike(pattern)
            )

        # Count total
        count_query = select(sa_func.count()).select_from(base_query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        # Fetch paginated with eager-loaded User
        query = (
            base_query
            .options(selectinload(Teacher.user))
            .order_by(User.first_name, User.last_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)

        logger.debug(
            "search_by_name(school=%s, search=%s) -> %d of %d",
            school_id, search, len(result.scalars().all()), total,
        )
        result = await self.db.execute(query)
        return list(result.scalars().all()), total
