"""Repository for Class model.

Provides CRUD operations for class groups with specialised queries
for teacher-based and active-class lookups.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academic_class import Class
from app.repository.base import BaseRepository


class ClassRepository(BaseRepository[Class]):
    """Repository for class group management.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Class)

    async def get_by_teacher(self, teacher_id: str) -> list[Class]:
        """Return all classes assigned to a given teacher.

        Resolves teacher → class through the teacher_class_subjects
        mapping table. Includes eager loading of the academic year
        and class teacher for display purposes.
        """
        from app.models.teacher_class_subject import TeacherClassSubject

        query = (
            select(self.model)
            .distinct()
            .join(TeacherClassSubject, TeacherClassSubject.class_id == self.model.id)
            .where(TeacherClassSubject.teacher_id == teacher_id)
            .where(self.model.deleted_at.is_(None))
            .where(TeacherClassSubject.deleted_at.is_(None))
            .options(
                selectinload(self.model.academic_year),
                selectinload(self.model.class_teacher),
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_students_by_class(self, class_id: str) -> list:
        """Return all active, non-deleted students enrolled in a class.

        Results are ordered by ``roll_number`` for a natural class roster
        ordering. Uses the ``Student`` model directly.
        """
        from app.models.student import Student

        query = (
            select(Student)
            .where(Student.class_id == class_id)
            .where(Student.is_active.is_(True))
            .where(Student.deleted_at.is_(None))
            .order_by(Student.roll_number)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_active_classes(self, school_id: str) -> list[Class]:
        """Return all non-deleted classes for a school, ordered by name.

        Includes eager loading of the academic year and class teacher
        (with user relation) to avoid detached-instance errors when
        building response schemas after the DB session closes.
        """
        from app.models.teacher import Teacher

        query = (
            self._active_query()
            .where(self.model.school_id == school_id)
            .order_by(self.model.name)
            .options(
                selectinload(self.model.academic_year),
                selectinload(self.model.class_teacher).selectinload(Teacher.user),
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
