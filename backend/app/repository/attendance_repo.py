"""Attendance repository — data access for daily attendance records.

Provides school-scoped CRUD operations plus specialised queries for
class roll-call views and student attendance history. The attendance
table has no ``deleted_at`` column, so the base soft-delete filter
is automatically disabled for this model.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attendance import Attendance
from app.repository.base import BaseRepository


class AttendanceRepository(BaseRepository[Attendance]):
    """Repository for Attendance records.

    All queries are school-scoped and respect the soft-delete filter
    (the Attendance model has no ``deleted_at`` column, so the filter
    is a no-op).
    """

    _DEFAULT_OPTIONS = (
        selectinload(Attendance.student),
        selectinload(Attendance.class_),
        selectinload(Attendance.marker),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Attendance)

    async def get_by_student_and_date(
        self,
        student_id: str,
        attendance_date: date,
    ) -> Attendance | None:
        """Check if an attendance record already exists for a student on a given date.

        Used to prevent duplicate attendance marking.
        """
        query = (
            self._active_query()
            .where(Attendance.student_id == student_id)
            .where(Attendance.date == attendance_date)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_class_attendance_by_date(
        self,
        class_id: str,
        attendance_date: date,
        school_id: str | None = None,
    ) -> list[Attendance]:
        """Fetch all attendance records for a class on a specific date.

        Args:
            class_id: UUID of the class.
            attendance_date: The date to query.
            school_id: Optional school scope filter.

        Returns:
            A list of Attendance records with pre-loaded student and marker relations.
        """
        query = (
            self._active_query()
            .where(Attendance.class_id == class_id)
            .where(Attendance.date == attendance_date)
            .options(*self._DEFAULT_OPTIONS)
        )
        if school_id is not None:
            query = self._school_scope(query, school_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_class_attendance_range(
        self,
        class_id: str,
        start_date: date,
        end_date: date,
        school_id: str | None = None,
    ) -> list[Attendance]:
        """Fetch attendance records for a class over a date range.

        Args:
            class_id: UUID of the class.
            start_date: Inclusive start of the range.
            end_date: Inclusive end of the range.
            school_id: Optional school scope filter.

        Returns:
            A list of Attendance records ordered by date ascending.
        """
        query = (
            self._active_query()
            .where(Attendance.class_id == class_id)
            .where(Attendance.date >= start_date)
            .where(Attendance.date <= end_date)
            .order_by(Attendance.date.asc())
            .options(*self._DEFAULT_OPTIONS)
        )
        if school_id is not None:
            query = self._school_scope(query, school_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_student_attendance_by_term(
        self,
        student_id: str,
        academic_term_id: str,
    ) -> list[Attendance]:
        """Fetch attendance records for a student within an academic term.

        Args:
            student_id: UUID of the student.
            academic_term_id: UUID of the academic term.

        Returns:
            A list of Attendance records ordered by date descending.
        """
        query = (
            self._active_query()
            .where(Attendance.student_id == student_id)
            .where(Attendance.academic_term_id == academic_term_id)
            .order_by(Attendance.date.desc())
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_classes_attendance_by_date(
        self,
        class_ids: list[str],
        attendance_date: date,
        school_id: str | None = None,
    ) -> list[Attendance]:
        """Fetch attendance records for multiple classes on a specific date (batched query).

        Replaces the N+1 pattern of calling ``get_class_attendance_by_date``
        in a loop. Uses a single ``class_id.in_(class_ids)`` filter.

        Args:
            class_ids: List of class UUIDs.
            attendance_date: The date to query.
            school_id: Optional school scope filter.

        Returns:
            A list of Attendance records with pre-loaded student and marker relations.
        """
        if not class_ids:
            return []

        query = (
            self._active_query()
            .where(Attendance.class_id.in_(class_ids))
            .where(Attendance.date == attendance_date)
            .options(*self._DEFAULT_OPTIONS)
        )
        if school_id is not None:
            query = self._school_scope(query, school_id)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_today_by_school(
        self,
        school_id: str,
        attendance_date: date,
        academic_term_id: str,
    ) -> list[Attendance]:
        """Fetch all attendance records for a school on a given date.

        Used by principals/admins for the ``/attendance/today`` endpoint.
        """
        query = (
            self._active_query()
            .where(Attendance.school_id == school_id)
            .where(Attendance.academic_term_id == academic_term_id)
            .where(Attendance.date == attendance_date)
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
