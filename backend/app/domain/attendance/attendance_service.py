"""Attendance service — business logic for daily attendance operations.

Provides:
    - Marking attendance (with duplicate detection)
    - Class attendance roll-call views
    - Student attendance history
    - Teacher permission verification (teacher must teach the class)

All data access is delegated to ``AttendanceRepository``.
"""

from datetime import date

from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus
from app.repository.attendance_repo import AttendanceRepository
from app.repository.class_repo import ClassRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository


class AttendanceService:
    """Service for daily attendance management.

    Handles the full lifecycle of attendance records including:
        - Marking individual attendance (with duplicate prevention)
        - Batch class attendance queries
        - Student attendance history
        - Teacher permission checks
    """

    def __init__(
        self,
        attendance_repo: AttendanceRepository,
        tcs_repo: TeacherClassSubjectRepository,
    ) -> None:
        self._attendance_repo = attendance_repo
        self._tcs_repo = tcs_repo

    async def assert_teacher_teaches_class(
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
        # Check via TeacherClassSubject assignments
        assignments = await self._tcs_repo.get_by_class_and_term(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )
        for assignment in assignments:
            if str(assignment.teacher_id) == teacher_id:
                return

        # Check if teacher is the class teacher (form teacher)
        class_repo = ClassRepository(self._attendance_repo.db)
        cls = await class_repo.get(class_id)
        if cls and cls.class_teacher_id and str(cls.class_teacher_id) == teacher_id:
            return

        raise PermissionError(
            f"Teacher {teacher_id} is not assigned to class {class_id} "
            f"in academic term {academic_term_id}"
        )

    async def get_teacher_class_ids(
        self,
        teacher_id: str,
        academic_term_id: str,
    ) -> set[str]:
        """Return the set of class IDs a teacher is assigned to in a given term.

        Combines TeacherClassSubject assignments with class-teacher assignments.
        """
        # Get class IDs from teacher_class_subjects
        assignments = await self._tcs_repo.get_multi()
        # Filter in-memory since get_multi doesn't support arbitrary filters
        class_ids = {
            str(a.class_id) for a in assignments
            if a.teacher_id and str(a.teacher_id) == teacher_id
            and a.academic_term_id and str(a.academic_term_id) == academic_term_id
        }

        # Also add classes where teacher is the class teacher
        from app.models.academic_class import Class

        class_repo = ClassRepository(self._attendance_repo.db)
        classes = await class_repo.get_multi()
        for cls in classes:
            if cls.class_teacher_id and str(cls.class_teacher_id) == teacher_id:
                class_ids.add(str(cls.id))

        return class_ids

    async def mark_attendance(
        self,
        student_id: str,
        class_id: str,
        academic_term_id: str,
        school_id: str,
        attendance_date: date,
        status: AttendanceStatus,
        marked_by: str,
        remarks: str | None = None,
    ) -> Attendance:
        """Mark attendance for a student on a given date.

        Business rules:
            1. A student can only be marked once per day (enforced by the DB
               UNIQUE constraint on ``(student_id, date)``).
            2. The caller must be a teacher assigned to the class.
            3. School-scoped (tenant isolation).

        Args:
            student_id: UUID of the student.
            class_id: UUID of the class.
            academic_term_id: UUID of the academic term.
            school_id: UUID of the school (tenant scope).
            attendance_date: The date of the attendance record.
            status: Attendance status (present, absent, late, half_day).
            marked_by: Teacher UUID who is marking the attendance.
            remarks: Optional teacher notes.

        Returns:
            The newly created ``Attendance`` record.

        Raises:
            ValueError: If a record already exists for this student on this date.
            PermissionError: If the teacher is not assigned to the class.
        """
        # 1. Verify teacher teaches the class
        await self.assert_teacher_teaches_class(
            teacher_id=marked_by,
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

        # 2. Check for duplicate
        existing = await self._attendance_repo.get_by_student_and_date(
            student_id=student_id,
            attendance_date=attendance_date,
        )
        if existing is not None:
            raise ValueError(
                f"Attendance already exists for student {student_id} on "
                f"{attendance_date} (status: {existing.status}). "
                "Use update to modify the existing record."
            )

        # 3. Create the attendance record
        return await self._attendance_repo.create(
            student_id=student_id,
            class_id=class_id,
            academic_term_id=academic_term_id,
            school_id=school_id,
            date=attendance_date,
            status=status.value,
            marked_by=marked_by,
            remarks=remarks,
        )

    async def batch_mark_attendance(
        self,
        records: list[tuple[str, AttendanceStatus, str | None]],
        class_id: str,
        academic_term_id: str,
        school_id: str,
        attendance_date: date,
        marked_by: str,
    ) -> list[Attendance]:
        """Batch-mark attendance for multiple students in a class.

        The teacher permission check is performed **once** before processing
        any records, avoiding N+1 queries. If any record fails, a ``ValueError``
        or ``PermissionError`` is raised and no records are committed.

        Args:
            records: List of (student_id, status, remarks) tuples.
            class_id: UUID of the class.
            academic_term_id: UUID of the academic term.
            school_id: UUID of the school (tenant scope).
            attendance_date: The date of the attendance records.
            marked_by: Teacher UUID who is marking the attendance.

        Returns:
            A list of newly created ``Attendance`` records.

        Raises:
            ValueError: If a record already exists for this student on this date.
            PermissionError: If the teacher is not assigned to the class.
        """
        # Single permission check before processing any records
        await self.assert_teacher_teaches_class(
            teacher_id=marked_by,
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

        created: list[Attendance] = []
        for student_id, status, remarks in records:
            # Check for duplicate
            existing = await self._attendance_repo.get_by_student_and_date(
                student_id=student_id,
                attendance_date=attendance_date,
            )
            if existing is not None:
                raise ValueError(
                    f"Attendance already exists for student {student_id} on "
                    f"{attendance_date} (status: {existing.status})."
                )

            record = await self._attendance_repo.create(
                student_id=student_id,
                class_id=class_id,
                academic_term_id=academic_term_id,
                school_id=school_id,
                date=attendance_date,
                status=status.value,
                marked_by=marked_by,
                remarks=remarks,
            )
            created.append(record)

        return created

    async def get_class_attendance(
        self,
        class_id: str,
        attendance_date: date | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        school_id: str | None = None,
    ) -> list[Attendance]:
        """Get attendance records for a class, optionally filtered by date.

        If only ``attendance_date`` is provided, returns records for that day.
        If ``start_date`` and ``end_date`` are provided (or just ``start_date``),
        returns records over that range.
        If none are provided, returns all records for the class.

        Args:
            class_id: UUID of the class.
            attendance_date: Optional single date filter.
            start_date: Optional start of date range.
            end_date: Optional end of date range (defaults to start_date if not given).
            school_id: Optional school scope.

        Returns:
            A list of Attendance records with pre-loaded relationships.
        """
        if attendance_date is not None:
            return await self._attendance_repo.get_class_attendance_by_date(
                class_id=class_id,
                attendance_date=attendance_date,
                school_id=school_id,
            )

        start = start_date or date(1900, 1, 1)
        end = end_date or start_date or date(2100, 12, 31)

        return await self._attendance_repo.get_class_attendance_range(
            class_id=class_id,
            start_date=start,
            end_date=end,
            school_id=school_id,
        )

    async def get_student_attendance(
        self,
        student_id: str,
        academic_term_id: str,
    ) -> list[Attendance]:
        """Get all attendance records for a student within an academic term.

        Args:
            student_id: UUID of the student.
            academic_term_id: UUID of the academic term.

        Returns:
            A list of Attendance records ordered by date descending.
        """
        return await self._attendance_repo.get_student_attendance_by_term(
            student_id=student_id,
            academic_term_id=academic_term_id,
        )

    async def get_today_attendance(
        self,
        school_id: str,
        attendance_date: date,
        academic_term_id: str,
    ) -> list[Attendance]:
        """Get all attendance records for a school on a given date.

        Used by principals/admins for a school-wide attendance overview.
        """
        return await self._attendance_repo.get_today_by_school(
            school_id=school_id,
            attendance_date=attendance_date,
            academic_term_id=academic_term_id,
        )
