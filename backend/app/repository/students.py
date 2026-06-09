"""Student repository — data access for student profiles.

All queries are school-scoped and respect soft-delete filtering
inherited from BaseRepository.
"""

from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.class_enrollment import ClassEnrollment
from app.models.parent import Parent as ParentModel
from app.models.student import Student
from app.models.student_parent import StudentParent
from app.models.user import User
from app.repository.base import BaseRepository


class StudentRepository(BaseRepository[Student]):
    """Repository for Student records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Student)

    async def get_by_user_id(self, user_id: str) -> Student | None:
        """Fetch a student record by the associated user_id."""
        query = self._active_query().where(Student.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_user(self, student_id: str) -> Student | None:
        """Fetch a student with the associated User eagerly loaded."""
        query = (
            self._active_query()
            .where(Student.id == student_id)
            .options(selectinload(Student.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_details(self, student_id: str) -> Student | None:
        """Fetch a student with user, class, parents, and enrollments eagerly loaded."""
        query = (
            self._active_query()
            .where(Student.id == student_id)
            .options(
                selectinload(Student.user),
                selectinload(Student.class_),
                # Load student-parent links with parent + parent user
                selectinload(Student.student_parents),
                selectinload(Student.student_parents).selectinload(
                    StudentParent.parent
                ),
                selectinload(Student.student_parents)
                .selectinload(StudentParent.parent)
                .selectinload(ParentModel.user),
                # Load class enrollments with class + academic year
                selectinload(Student.class_enrollments),
                selectinload(Student.class_enrollments).selectinload(
                    ClassEnrollment.class_
                ),
                selectinload(Student.class_enrollments)
                .selectinload(ClassEnrollment.class_)
                .selectinload(ClassEnrollment.class_.academic_year),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def search_by_name(
        self,
        school_id: str,
        search: str | None = None,
        class_id: str | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Student], int]:
        """Search students within a school with optional filters.

        Args:
            school_id: School UUID for tenant isolation.
            search: Optional search string (matches name, admission_number).
            class_id: Optional class filter.
            is_active: Optional active status filter.
            skip: Pagination offset.
            limit: Page size.

        Returns:
            Tuple of (students_list, total_count).
        """
        # Always join User for ordering — also needed for search filtering
        base_query = (
            self._active_query()
            .join(Student.user)
            .where(Student.school_id == school_id)
        )

        if class_id is not None:
            base_query = base_query.where(Student.class_id == class_id)

        if is_active is not None:
            base_query = base_query.where(Student.is_active.is_(is_active))

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                User.first_name.ilike(pattern)
                | User.last_name.ilike(pattern)
                | Student.admission_number.ilike(pattern)
            )

        # Count total
        count_query = select(sa_func.count()).select_from(base_query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        # Fetch paginated with eagerly loaded user and class
        query = base_query.options(
            selectinload(Student.class_),
            selectinload(Student.user),
        )
        query = query.order_by(User.first_name).offset(skip).limit(limit)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total

    async def get_by_class(
        self,
        class_id: str,
        school_id: str,
        is_active: bool = True,
    ) -> list[Student]:
        """Fetch all active students in a class."""
        query = (
            self._active_query()
            .where(Student.class_id == class_id)
            .where(Student.school_id == school_id)
            .where(Student.is_active.is_(is_active))
            .options(selectinload(Student.user))
            .order_by(Student.roll_number)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
