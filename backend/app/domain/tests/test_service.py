"""Test service — business logic for test/exam management.

Provides:
    - Creating tests (with teacher permission checks)
    - Viewing tests by class or student
    - Starting and submitting test attempts
    - Viewing test results

All data access is delegated to ``TestRepository`` and
``TestAttemptRepository``.
"""

from datetime import datetime, timezone

from app.models.enums import AttemptStatus
from app.models.test import Test
from app.models.test_attempt import TestAttempt
from app.repository.class_repo import ClassRepository
from app.repository.test_attempt_repo import TestAttemptRepository
from app.repository.test_repo import TestRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository


class TestService:
    """Service for test management.

    Handles creation, viewing, attempts, and results of tests
    with proper permission checks and business rule enforcement.
    """

    def __init__(
        self,
        test_repo: TestRepository,
        attempt_repo: TestAttemptRepository,
        tcs_repo: TeacherClassSubjectRepository,
    ) -> None:
        self._test_repo = test_repo
        self._attempt_repo = attempt_repo
        self._tcs_repo = tcs_repo

    async def _assert_teacher_teaches_class(
        self,
        teacher_id: str,
        class_id: str,
        academic_term_id: str,
    ) -> None:
        """Verify that a teacher is assigned to teach the given class in the given term.

        Raises ``PermissionError`` if the teacher is not assigned.
        """
        assignments = await self._tcs_repo.get_by_class_and_term(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )
        for assignment in assignments:
            if str(assignment.teacher_id) == teacher_id:
                return

        class_repo = ClassRepository(self._test_repo.db)
        cls = await class_repo.get(class_id)
        if cls and cls.class_teacher_id and str(cls.class_teacher_id) == teacher_id:
            return

        raise PermissionError(
            f"Teacher {teacher_id} is not assigned to class {class_id} "
            f"in academic term {academic_term_id}"
        )

    async def create_test(
        self,
        teacher_id: str,
        class_id: str,
        subject_id: str,
        academic_term_id: str,
        school_id: str,
        title: str,
        total_marks: float,
        duration_minutes: int,
        description: str | None = None,
        test_type: str = "unit_test",
        scheduled_at: datetime | None = None,
        passing_percentage: float = 40.00,
        is_published: bool = False,
    ) -> Test:
        """Create a new test/exam.

        Business rules:
            1. Teacher must be assigned to teach the class in the given term.
            2. Test is scoped to a class, subject, teacher, and academic term.

        Args:
            teacher_id: UUID of the creating teacher.
            class_id: UUID of the target class.
            subject_id: UUID of the subject.
            academic_term_id: UUID of the academic term.
            school_id: UUID of the school (tenant scope).
            title: Test title.
            total_marks: Total marks for the test.
            duration_minutes: Duration in minutes (max 480).
            description: Optional description/instructions.
            test_type: Type of test (quiz, unit_test, midterm, final).
            scheduled_at: Optional scheduled date/time.
            passing_percentage: Minimum percentage to pass (default 40).
            is_published: Whether the test is published immediately.

        Returns:
            The newly created ``Test`` record.

        Raises:
            PermissionError: If the teacher is not assigned to the class.
        """
        await self._assert_teacher_teaches_class(
            teacher_id=teacher_id,
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

        now = datetime.now(timezone.utc)

        return await self._test_repo.create(
            teacher_id=teacher_id,
            class_id=class_id,
            subject_id=subject_id,
            academic_term_id=academic_term_id,
            school_id=school_id,
            title=title,
            total_marks=total_marks,
            duration_minutes=duration_minutes,
            description=description,
            test_type=test_type,
            scheduled_at=scheduled_at,
            passing_percentage=passing_percentage,
            is_published=is_published,
            published_at=now if is_published else None,
        )

    async def get_class_tests(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
        include_unpublished: bool = False,
    ) -> list[Test]:
        """Get tests for a class.

        By default, returns only published tests (for students).
        Teachers/admins can set ``include_unpublished=True`` to see drafts.

        Args:
            class_id: UUID of the class.
            school_id: UUID of the school (tenant scope).
            academic_term_id: Optional term filter.
            include_unpublished: If True, include draft tests.

        Returns:
            A list of Test records ordered by scheduled_at descending.
        """
        return await self._test_repo.get_by_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
            published_only=not include_unpublished,
        )

    async def get_student_tests(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
    ) -> list[Test]:
        """Get published tests visible to a student.

        Students can only see published tests for their class.
        """
        return await self._test_repo.get_published_for_student_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
        )

    async def start_attempt(
        self,
        student_id: str,
        test_id: str,
        school_id: str,
        student_class_id: str | None = None,
    ) -> TestAttempt:
        """Start a test attempt.

        Business rules:
            1. A student can only attempt once per test (enforced by the DB
               UNIQUE constraint on ``(test_id, student_id)``).
            2. Test must be published.
            3. Student must be enrolled in the test's class.
            4. Test cannot be started before its scheduled time.

        Args:
            student_id: UUID of the student.
            test_id: UUID of the test.
            school_id: UUID of the school (tenant scope).
            student_class_id: UUID of the student's class for membership check.

        Returns:
            The newly created ``TestAttempt`` record.

        Raises:
            ValueError: If the test is not found, not published, already
                attempted, not scheduled yet, or not assigned to the
                student's class.
        """
        test = await self._test_repo.get(test_id)
        if test is None:
            raise ValueError(f"Test {test_id} not found")

        if not test.is_published:
            raise ValueError("Test is not yet published")

        # Check class membership
        if student_class_id is not None and str(test.class_id) != student_class_id:
            raise ValueError(
                f"Test {test_id} is not assigned to your class"
            )

        # Check scheduled time
        now = datetime.now(timezone.utc)
        if test.scheduled_at is not None:
            sched = test.scheduled_at
            if sched.tzinfo is None:
                sched = sched.replace(tzinfo=timezone.utc)
            if now < sched:
                raise ValueError(
                    f"Test has not started yet — scheduled for {sched.isoformat()}"
                )

        existing = await self._attempt_repo.get_by_student_and_test(
            student_id=student_id,
            test_id=test_id,
        )
        if existing is not None:
            raise ValueError(
                f"Already attempted test {test_id} "
                f"(status: {existing.status})"
            )

        return await self._attempt_repo.create(
            test_id=test_id,
            student_id=student_id,
            school_id=school_id,
            status=AttemptStatus.IN_PROGRESS.value,
            started_at=now,
        )

    async def submit_attempt(
        self,
        student_id: str,
        test_id: str,
    ) -> TestAttempt:
        """Submit a test attempt.

        Rules:
            1. An attempt must exist (call ``start_attempt`` first).
            2. Attempt must be in ``in_progress`` state.
            3. Submission deadline cannot have passed (test duration elapsed).

        Args:
            student_id: UUID of the student.
            test_id: UUID of the test.

        Returns:
            The updated ``TestAttempt`` record.

        Raises:
            ValueError: If no attempt exists, already submitted, or
                time limit exceeded.
        """
        existing = await self._attempt_repo.get_by_student_and_test(
            student_id=student_id,
            test_id=test_id,
        )
        if existing is None:
            raise ValueError(
                "No attempt found. Use start_attempt to begin the test first."
            )

        if existing.status != AttemptStatus.IN_PROGRESS.value:
            raise ValueError(
                f"Cannot submit — attempt is in status '{existing.status}'. "
                "Only in-progress attempts can be submitted."
            )

        now = datetime.now(timezone.utc)
        started = existing.started_at
        if started and started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)

        # Check duration limit
        duration = existing.test.duration_minutes if existing.test else None
        if duration and started:
            elapsed = (now - started).total_seconds() / 60
            if elapsed > duration:
                raise ValueError(
                    f"Test duration of {duration} minutes has been exceeded "
                    f"({elapsed:.0f} minutes elapsed). Auto-submitting."
                )

        return await self._attempt_repo.update(
            existing.id,
            status=AttemptStatus.SUBMITTED.value,
            submitted_at=now,
        )

    async def get_test_results(
        self,
        test_id: str,
        school_id: str,
    ) -> list[TestAttempt]:
        """Get all attempts/results for a test.

        Used by teachers to view results for their tests.

        Args:
            test_id: UUID of the test.
            school_id: UUID of the school (tenant scope).

        Returns:
            A list of TestAttempt records with pre-loaded relations.
        """
        return await self._attempt_repo.get_by_test(
            test_id=test_id,
            school_id=school_id,
        )

    async def get_student_attempt(
        self,
        student_id: str,
        test_id: str,
    ) -> TestAttempt | None:
        """Get a student's attempt for a specific test.

        Used by students to view their own attempt/result.

        Args:
            student_id: UUID of the student.
            test_id: UUID of the test.

        Returns:
            The TestAttempt record if it exists, None otherwise.
        """
        return await self._attempt_repo.get_by_student_and_test(
            student_id=student_id,
            test_id=test_id,
        )
