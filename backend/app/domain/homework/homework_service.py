"""Homework service — business logic for homework assignments and submissions.

Provides:
    - Creating homework (with teacher permission checks)
    - Viewing homework by class or student
    - Submitting homework (with duplicate and due-date validation)
    - Viewing submissions (teacher view)

All data access is delegated to ``HomeworkRepository`` and
``HomeworkSubmissionRepository``.
"""

from datetime import datetime, timezone

from app.models.enums import AttemptStatus
from app.models.homework import Homework
from app.models.homework_submission import HomeworkSubmission
from app.repository.class_repo import ClassRepository
from app.repository.homework_repo import HomeworkRepository
from app.repository.homework_submission_repo import HomeworkSubmissionRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository


class HomeworkService:
    """Service for homework management.

    Handles creation, viewing, and submission of homework assignments
    with proper permission checks and business rule enforcement.
    """

    def __init__(
        self,
        homework_repo: HomeworkRepository,
        submission_repo: HomeworkSubmissionRepository,
        tcs_repo: TeacherClassSubjectRepository,
    ) -> None:
        self._homework_repo = homework_repo
        self._submission_repo = submission_repo
        self._tcs_repo = tcs_repo

    async def _assert_teacher_teaches_class(
        self,
        teacher_id: str,
        class_id: str,
        academic_term_id: str,
    ) -> None:
        """Verify that a teacher is assigned to teach the given class in the given term.

        Checks two avenues:
            1. The teacher has a ``TeacherClassSubject`` assignment for this class/term.
            2. The teacher is the designated ``class_teacher`` for this class.

        Raises ``PermissionError`` if the teacher is not assigned.
        """
        assignments = await self._tcs_repo.get_by_class_and_term(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )
        for assignment in assignments:
            if str(assignment.teacher_id) == teacher_id:
                return

        class_repo = ClassRepository(self._homework_repo.db)
        cls = await class_repo.get(class_id)
        if cls and cls.class_teacher_id and str(cls.class_teacher_id) == teacher_id:
            return

        raise PermissionError(
            f"Teacher {teacher_id} is not assigned to class {class_id} "
            f"in academic term {academic_term_id}"
        )

    async def create_homework(
        self,
        teacher_id: str,
        class_id: str,
        subject_id: str,
        academic_term_id: str,
        school_id: str,
        title: str,
        due_date: datetime,
        description: str | None = None,
        max_score: float = 100.00,
        is_published: bool = False,
    ) -> Homework:
        """Create a new homework assignment.

        Business rules:
            1. Teacher must be assigned to teach the class in the given term.
            2. Homework is scoped to a class, subject, teacher, and academic term.

        Args:
            teacher_id: UUID of the creating teacher.
            class_id: UUID of the target class.
            subject_id: UUID of the subject.
            academic_term_id: UUID of the academic term.
            school_id: UUID of the school (tenant scope).
            title: Homework title.
            due_date: Submission deadline.
            description: Optional description/instructions.
            max_score: Maximum possible score (default 100).
            is_published: Whether the homework is published immediately.

        Returns:
            The newly created ``Homework`` record.

        Raises:
            PermissionError: If the teacher is not assigned to the class.
        """
        await self._assert_teacher_teaches_class(
            teacher_id=teacher_id,
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

        return await self._homework_repo.create(
            teacher_id=teacher_id,
            class_id=class_id,
            subject_id=subject_id,
            academic_term_id=academic_term_id,
            school_id=school_id,
            title=title,
            due_date=due_date,
            description=description,
            max_score=max_score,
            is_published=is_published,
            published_at=datetime.now(timezone.utc) if is_published else None,
        )

    async def get_class_homework(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
        include_unpublished: bool = False,
    ) -> list[Homework]:
        """Get homework assignments for a class.

        By default, returns only published homeworks (for students).
        Teachers/admins can set ``include_unpublished=True`` to see drafts too.

        Args:
            class_id: UUID of the class.
            school_id: UUID of the school (tenant scope).
            academic_term_id: Optional term filter.
            include_unpublished: If True, include draft/unpublished homeworks.

        Returns:
            A list of Homework records ordered by due_date descending.
        """
        return await self._homework_repo.get_by_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
            published_only=not include_unpublished,
        )

    async def get_student_homework(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
    ) -> list[Homework]:
        """Get published homework assignments visible to a student.

        Students can only see published homeworks for their class.
        """
        return await self._homework_repo.get_published_for_student_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
        )

    async def submit_homework(
        self,
        student_id: str,
        homework_id: str,
        school_id: str,
    ) -> HomeworkSubmission:
        """Submit a homework assignment.

        Business rules:
            1. A student can only submit once per homework (enforced by the DB
               UNIQUE constraint on ``(homework_id, student_id)``).
            2. Submission must be before the due date.
            3. Homework must be published.

        Args:
            student_id: UUID of the submitting student.
            homework_id: UUID of the homework.
            school_id: UUID of the school (tenant scope).

        Returns:
            The newly created ``HomeworkSubmission`` record.

        Raises:
            ValueError: If the homework is not published, past due, or
                already submitted.
        """
        # 1. Check homework exists and is published
        homework = await self._homework_repo.get(homework_id)
        if homework is None:
            raise ValueError(f"Homework {homework_id} not found")

        if not homework.is_published:
            raise ValueError("Homework is not yet published")

        now = datetime.now(timezone.utc)
        due = homework.due_date

        # Handle both timezone-aware and naive datetimes
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        if now > due:
            raise ValueError("Submission deadline has passed")

        # 2. Check for existing submission
        existing = await self._submission_repo.get_by_student_and_homework(
            student_id=student_id,
            homework_id=homework_id,
        )
        if existing is not None:
            raise ValueError(
                f"Already submitted for homework {homework_id} "
                f"(status: {existing.status}). Use update_submission "
                "to modify the existing submission."
            )

        # 3. Create the submission
        return await self._submission_repo.create(
            homework_id=homework_id,
            student_id=student_id,
            school_id=school_id,
            status=AttemptStatus.SUBMITTED.value,
            submitted_at=now,
        )

    async def update_submission(
        self,
        student_id: str,
        homework_id: str,
    ) -> HomeworkSubmission:
        """Update (re-submit) a homework submission before the due date.

        Rules:
            1. A submission must already exist (call ``submit_homework`` first).
            2. The due date must not have passed.
            3. The submission must not have been graded yet.

        Args:
            student_id: UUID of the student.
            homework_id: UUID of the homework.

        Returns:
            The updated ``HomeworkSubmission`` record.

        Raises:
            ValueError: If no submission exists, due date passed, or
                submission already graded.
        """
        homework = await self._homework_repo.get(homework_id)
        if homework is None:
            raise ValueError(f"Homework {homework_id} not found")

        now = datetime.now(timezone.utc)
        due = homework.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        if now > due:
            raise ValueError("Cannot update submission — due date has passed")

        existing = await self._submission_repo.get_by_student_and_homework(
            student_id=student_id,
            homework_id=homework_id,
        )
        if existing is None:
            raise ValueError(
                "No submission found. Use submit_homework to create one first."
            )

        if existing.is_graded:
            raise ValueError("Cannot update a graded submission")

        return await self._submission_repo.update(
            existing.id,
            status=AttemptStatus.SUBMITTED.value,
            submitted_at=now,
        )

    async def get_homework_submissions(
        self,
        homework_id: str,
        school_id: str,
    ) -> list[HomeworkSubmission]:
        """Get all submissions for a homework assignment.

        Used by teachers to view submissions for their homework.

        Args:
            homework_id: UUID of the homework.
            school_id: UUID of the school (tenant scope).

        Returns:
            A list of HomeworkSubmission records with pre-loaded
            student and homework relations.
        """
        return await self._submission_repo.get_by_homework(
            homework_id=homework_id,
            school_id=school_id,
        )
