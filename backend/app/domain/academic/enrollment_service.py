"""Service layer for student enrollment operations.

Provides business logic for enrolling students into classes,
transferring between classes, and querying enrollment history.
"""

from datetime import datetime, timezone

from app.models.class_enrollment import ClassEnrollment
from app.models.enums import EnrollmentStatus
from app.repository.class_enrollment_repo import ClassEnrollmentRepository


class EnrollmentService:
    """Service for student enrollment management.

    Handles the full lifecycle of class enrollments including:
        - Initial enrollment into a class
        - Transfer between classes (completes old, creates new)
        - Historical querying

    All data access is delegated to ``ClassEnrollmentRepository``.
    """

    def __init__(
        self,
        enrollment_repo: ClassEnrollmentRepository,
    ) -> None:
        self._enrollment_repo = enrollment_repo

    async def enroll_student(
        self,
        student_id: str,
        class_id: str,
        academic_year_id: str,
        school_id: str,
    ) -> ClassEnrollment:
        """Enrol a student into a class for a given academic year.

        Business rules:
            1. A student cannot have more than one enrollment record
               in the same academic year (enforced by the DB unique
               constraint on ``(student_id, academic_year_id)``).
            2. If the student already has an enrollment record for
               this academic year (regardless of status), a new
               enrollment cannot be created — the old one must be
               transferred or the status updated.

        Args:
            student_id: UUID of the student to enrol.
            class_id: UUID of the target class.
            academic_year_id: UUID of the academic year.
            school_id: UUID of the school (tenant scope).

        Returns:
            The newly created ``ClassEnrollment`` record.

        Raises:
            ValueError: If the student already has an enrollment record
                for this academic year (regardless of status).
        """
        # Check for ANY existing enrollment in this academic year
        # (not just active ones — the DB UNIQUE constraint on
        # (student_id, academic_year_id) prevents duplicates regardless)
        existing = await self._get_enrollment_for_year(student_id, academic_year_id)
        if existing is not None:
            raise ValueError(
                f"Student {student_id} already has an enrollment record "
                f"(status: {existing.status}) for academic year "
                f"{academic_year_id}. Transfer or update the existing "
                "record instead."
            )

        return await self._enrollment_repo.create(
            student_id=student_id,
            class_id=class_id,
            academic_year_id=academic_year_id,
            school_id=school_id,
            status=EnrollmentStatus.ACTIVE.value,
        )

    async def _get_enrollment_for_year(
        self,
        student_id: str,
        academic_year_id: str,
    ) -> ClassEnrollment | None:
        """Check if a student already has an enrollment record for an academic year."""
        history = await self._enrollment_repo.get_student_history(student_id)
        for enrollment in history:
            if str(enrollment.academic_year_id) == academic_year_id:
                return enrollment
        return None

    async def transfer_student(
        self,
        student_id: str,
        new_class_id: str,
        academic_year_id: str,
        school_id: str,
    ) -> ClassEnrollment:
        """Transfer a student from their current class to a new one.

        This is a two-step operation:
            1. The current active enrollment is marked as completed
               with status ``\"transferred\"`` and its ``completed_at``
               set to the current timestamp.
            2. A new enrollment record is created for the target class
               with status ``\"active\"``.

        Args:
            student_id: UUID of the student to transfer.
            new_class_id: UUID of the destination class.
            academic_year_id: UUID of the academic year.
            school_id: UUID of the school (tenant scope).

        Returns:
            The newly created ``ClassEnrollment`` for the target class.

        Raises:
            ValueError: If the student has no current active enrollment
                and therefore cannot be transferred.
        """
        # Complete the current enrollment
        current = await self._enrollment_repo.get_current_enrollment(
            student_id,
        )
        if current is None:
            raise ValueError(
                f"Student {student_id} has no active enrollment to transfer from"
            )

        now = datetime.now(timezone.utc)

        # Mark old enrollment as transferred
        await self._enrollment_repo.update(
            current.id,
            status=EnrollmentStatus.TRANSFERRED.value,
            completed_at=now,
        )

        # Create new enrollment
        return await self._enrollment_repo.create(
            student_id=student_id,
            class_id=new_class_id,
            academic_year_id=academic_year_id,
            school_id=school_id,
            status=EnrollmentStatus.ACTIVE.value,
        )

    async def get_student_history(
        self,
        student_id: str,
    ) -> list[ClassEnrollment]:
        """Return the full enrollment history for a student.

        Results include all statuses (active, promoted, transferred,
        graduated, withdrawn) ordered by ``enrolled_at`` descending
        (most recent first).

        Args:
            student_id: UUID of the student.

        Returns:
            A list of ``ClassEnrollment`` records with related
            entities pre-loaded.
        """
        return await self._enrollment_repo.get_student_history(
            student_id,
        )
