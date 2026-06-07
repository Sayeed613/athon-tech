"""Homework submission repository — data access for student submissions.

Provides school-scoped CRUD plus queries for homework-level roll-ups
and student-specific submission history.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.homework_submission import HomeworkSubmission
from app.models.student import Student
from app.models.subject import Subject
from app.repository.base import BaseRepository


class HomeworkSubmissionRepository(BaseRepository[HomeworkSubmission]):
    """Repository for HomeworkSubmission records.

    The HomeworkSubmission model has no ``deleted_at`` column, so the
    soft-delete filter is automatically disabled by the base class.
    """

    _DEFAULT_OPTIONS = (
        selectinload(HomeworkSubmission.student).selectinload(Student.user),
        selectinload(HomeworkSubmission.homework),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, HomeworkSubmission)

    async def get_by_homework(
        self,
        homework_id: str,
        school_id: str | None = None,
    ) -> list[HomeworkSubmission]:
        """Fetch all submissions for a specific homework.

        Args:
            homework_id: UUID of the homework.
            school_id: Optional school scope filter.

        Returns:
            A list of HomeworkSubmission records with pre-loaded
            student and homework relations, ordered by submitted_at.
        """
        query = (
            select(HomeworkSubmission)
            .where(HomeworkSubmission.homework_id == homework_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = query.where(HomeworkSubmission.school_id == school_id)

        query = query.order_by(HomeworkSubmission.submitted_at.asc().nullsfirst())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_student_and_homework(
        self,
        student_id: str,
        homework_id: str,
    ) -> HomeworkSubmission | None:
        """Check if a student has already submitted for a specific homework.

        Enforces the one-submission-per-student-per-homework rule.
        """
        query = (
            select(HomeworkSubmission)
            .where(HomeworkSubmission.student_id == student_id)
            .where(HomeworkSubmission.homework_id == homework_id)
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_student_submissions(
        self,
        student_id: str,
        school_id: str | None = None,
    ) -> list[HomeworkSubmission]:
        """Fetch all submissions by a student across all homeworks.

        Args:
            student_id: UUID of the student.
            school_id: Optional school scope filter.

        Returns:
            A list of HomeworkSubmission records with pre-loaded
            homework and student relations, ordered by submitted_at desc.
        """
        query = (
            select(HomeworkSubmission)
            .where(HomeworkSubmission.student_id == student_id)
            .options(
                selectinload(HomeworkSubmission.homework).selectinload(Subject),
                selectinload(HomeworkSubmission.student),
            )
        )

        if school_id is not None:
            query = query.where(HomeworkSubmission.school_id == school_id)

        query = query.order_by(HomeworkSubmission.submitted_at.desc().nullsfirst())

        result = await self.db.execute(query)
        return list(result.scalars().all())
