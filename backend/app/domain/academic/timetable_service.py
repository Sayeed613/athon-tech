"""Service layer for timetable operations.

Provides business logic for querying schedules and validating
timetable entries to prevent double-booking of teachers and
classrooms.
"""

from app.models.timetable_entry import TimetableEntry
from app.repository.timetable_repo import TimetableRepository


class TimetableService:
    """Service for timetable management and conflict validation.

    All schedule queries delegate to ``TimetableRepository`` which
    handles eager-loading of related entities and N+1 prevention.
    """

    def __init__(self, timetable_repo: TimetableRepository) -> None:
        self._timetable_repo = timetable_repo

    async def get_teacher_schedule(
        self,
        teacher_id: str,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return the full weekly schedule for a teacher.

        Delegates to ``TimetableRepository.get_teacher_schedule()``.
        """
        return await self._timetable_repo.get_teacher_schedule(
            teacher_id=teacher_id,
            academic_term_id=academic_term_id,
        )

    async def get_class_schedule(
        self,
        class_id: str,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return the full weekly timetable for a class.

        Delegates to ``TimetableRepository.get_class_schedule()``.
        """
        return await self._timetable_repo.get_class_schedule(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

    async def get_today_schedule(
        self,
        school_id: str,
        day_of_week: int,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return all active timetable entries for a given school day.

        Delegates to ``TimetableRepository.get_today_schedule()``.
        """
        return await self._timetable_repo.get_today_schedule(
            school_id=school_id,
            day_of_week=day_of_week,
            academic_term_id=academic_term_id,
        )

    async def validate_no_conflicts(
        self,
        teacher_id: str,
        class_id: str,
        day_of_week: int,
        period_id: str,
        academic_term_id: str,
        *,
        exclude_entry_id: str | None = None,
    ) -> list[dict[str, str]]:
        """Validate that a proposed timetable entry has no scheduling conflicts.

        Delegates conflict detection to ``TimetableRepository.check_conflict()``
        which runs two checks:
            1. Teacher double-booking: teacher already scheduled for (day, period)
            2. Class double-booking: class already has a subject for (day, period)

        Args:
            teacher_id: The teacher to check.
            class_id: The class to check.
            day_of_week: Day of week (1=Monday ... 6=Saturday).
            period_id: The period to check.
            academic_term_id: The academic term scope.
            exclude_entry_id: If set, exclude this entry ID from the
                conflict check (useful when updating an existing entry).

        Returns:
            A list of conflict descriptions. Each dict has a ``type``
            (``"teacher"`` or ``"class"``) and a ``detail`` message.
            Returns an empty list if no conflicts are found.
        """
        conflicts: list[dict[str, str]] = []

        # 1. Teacher conflict check
        teacher_conflict = await self._timetable_repo.check_conflict(
            teacher_id=teacher_id,
            day_of_week=day_of_week,
            period_id=period_id,
            academic_term_id=academic_term_id,
            exclude_entry_id=exclude_entry_id,
        )
        if teacher_conflict:
            conflicts.append({
                "type": "teacher",
                "detail": (
                    f"Teacher {teacher_id} is already scheduled for "
                    f"day {day_of_week}, period {period_id}"
                ),
            })

        # 2. Class conflict check
        class_conflict = await self._timetable_repo.check_conflict(
            class_id=class_id,
            day_of_week=day_of_week,
            period_id=period_id,
            academic_term_id=academic_term_id,
            exclude_entry_id=exclude_entry_id,
        )
        if class_conflict:
            conflicts.append({
                "type": "class",
                "detail": (
                    f"Class {class_id} already has a subject scheduled for "
                    f"day {day_of_week}, period {period_id}"
                ),
            })

        return conflicts
