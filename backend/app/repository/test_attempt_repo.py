"""Test attempt repository — data access for student test attempts.

Provides queries for test-level roll-ups and student-specific attempt history
with eager-loaded relationships.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.student import Student
from app.models.test import Test
from app.models.test_attempt import TestAttempt
from app.repository.base import BaseRepository


class TestAttemptRepository(BaseRepository[TestAttempt]):
    """Repository for TestAttempt records.

    The TestAttempt model has no ``deleted_at`` column, so the
    soft-delete filter is automatically disabled by the base class.
    """

    _DEFAULT_OPTIONS = (
        selectinload(TestAttempt.student).selectinload(Student.user),
        selectinload(TestAttempt.test),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TestAttempt)

    async def get_by_test(
        self,
        test_id: str,
        school_id: str | None = None,
    ) -> list[TestAttempt]:
        """Fetch all attempts for a specific test.

        Args:
            test_id: UUID of the test.
            school_id: Optional school scope filter.

        Returns:
            A list of TestAttempt records ordered by submitted_at.
        """
        query = (
            select(TestAttempt)
            .where(TestAttempt.test_id == test_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = query.where(TestAttempt.school_id == school_id)

        query = query.order_by(TestAttempt.submitted_at.asc().nullsfirst())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_student_and_test(
        self,
        student_id: str,
        test_id: str,
    ) -> TestAttempt | None:
        """Check if a student has an attempt for a specific test.

        Enforces the one-attempt-per-student-per-test rule.
        """
        query = (
            select(TestAttempt)
            .where(TestAttempt.student_id == student_id)
            .where(TestAttempt.test_id == test_id)
            .options(
                selectinload(TestAttempt.answers),
                selectinload(TestAttempt.test).selectinload(Test.questions),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_student_attempts(
        self,
        student_id: str,
        school_id: str | None = None,
    ) -> list[TestAttempt]:
        """Fetch all attempts by a student across all tests.

        Args:
            student_id: UUID of the student.
            school_id: Optional school scope filter.

        Returns:
            A list of TestAttempt records ordered by submitted_at desc.
        """
        query = (
            select(TestAttempt)
            .where(TestAttempt.student_id == student_id)
            .options(
                selectinload(TestAttempt.test).selectinload(Test.subject),
                selectinload(TestAttempt.student),
            )
        )

        if school_id is not None:
            query = query.where(TestAttempt.school_id == school_id)

        query = query.order_by(TestAttempt.submitted_at.desc().nullsfirst())

        result = await self.db.execute(query)
        return list(result.scalars().all())
