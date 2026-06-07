"""Repository for TimetableEntry model.

Provides CRUD operations and specialised schedule queries with
eager-loaded relationships to prevent N+1 queries.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.timetable_entry import TimetableEntry
from app.repository.base import BaseRepository


class TimetableRepository(BaseRepository[TimetableEntry]):
    """Repository for timetable management.

    All queries use ``selectinload()`` to eagerly load the related
    school, term, class, subject, teacher, and period — the six
    relationships that would otherwise trigger N+1 queries.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    _DEFAULT_OPTIONS = (
        selectinload(TimetableEntry.academic_term),
        selectinload(TimetableEntry.class_),
        selectinload(TimetableEntry.subject),
        selectinload(TimetableEntry.teacher),
        selectinload(TimetableEntry.period),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TimetableEntry)

    async def get(self, id: str) -> TimetableEntry | None:  # type: ignore[override]
        """Fetch a single timetable entry with all related entities eager-loaded."""
        query = (
            select(self.model)
            .where(self.model.id == id)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def check_conflict(
        self,
        *,
        teacher_id: str | None = None,
        class_id: str | None = None,
        day_of_week: int,
        period_id: str,
        academic_term_id: str,
        exclude_entry_id: str | None = None,
    ) -> bool:
        """Check if a proposed timetable entry would cause a conflict.

        Args:
            teacher_id: If provided, checks teacher double-booking.
            class_id: If provided, checks class double-booking.
            day_of_week: Day of week (1=Monday … 6=Saturday).
            period_id: The period to check.
            academic_term_id: The academic term scope.
            exclude_entry_id: If set, exclude this entry from the check.

        Returns:
            ``True`` if a conflict exists, ``False`` otherwise.
        """
        from sqlalchemy import and_

        conditions = [
            self.model.day_of_week == day_of_week,
            self.model.period_id == period_id,
            self.model.academic_term_id == academic_term_id,
            self.model.deleted_at.is_(None),
            self.model.is_active.is_(True),
        ]

        if teacher_id is not None:
            conditions.append(self.model.teacher_id == teacher_id)

        if class_id is not None:
            conditions.append(self.model.class_id == class_id)

        if exclude_entry_id is not None:
            conditions.append(self.model.id != exclude_entry_id)

        query = select(self.model).where(and_(*conditions)).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_multi(  # type: ignore[override]
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        school_id: str | None = None,
        order_by: Any | None = None,
    ) -> list[TimetableEntry]:
        """Fetch multiple timetable entries with eager-loaded relationships."""
        query = (
            select(self.model)
            .where(self.model.deleted_at.is_(None))
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = query.where(self.model.school_id == school_id)

        if order_by is not None:
            query = query.order_by(order_by)

        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_teacher_schedule(
        self,
        teacher_id: str,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return the full weekly schedule for a teacher in a given term.

        Results are ordered by day_of_week and then by period number,
        making them ready for rendering in a timetable grid.
        """
        from app.models.period import Period

        query = (
            select(self.model)
            .where(self.model.teacher_id == teacher_id)
            .where(self.model.academic_term_id == academic_term_id)
            .where(self.model.deleted_at.is_(None))
            .where(self.model.is_active.is_(True))
            .options(*self._DEFAULT_OPTIONS)
            .order_by(self.model.day_of_week, Period.period_number)
            .join(Period, Period.id == self.model.period_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_class_schedule(
        self,
        class_id: str,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return the full weekly timetable for a class in a given term.

        Results are ordered by day_of_week and then by period number,
        suitable for rendering a class timetable grid.
        """
        from app.models.period import Period

        query = (
            select(self.model)
            .where(self.model.class_id == class_id)
            .where(self.model.academic_term_id == academic_term_id)
            .where(self.model.deleted_at.is_(None))
            .where(self.model.is_active.is_(True))
            .options(*self._DEFAULT_OPTIONS)
            .order_by(self.model.day_of_week, Period.period_number)
            .join(Period, Period.id == self.model.period_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_today_schedule(
        self,
        school_id: str,
        day_of_week: int,
        academic_term_id: str,
    ) -> list[TimetableEntry]:
        """Return all active timetable entries for a given school day.

        Useful for generating today's schedule view for a school.
        Results are ordered by period number for chronological display.
        """
        from app.models.period import Period

        query = (
            select(self.model)
            .where(self.model.school_id == school_id)
            .where(self.model.day_of_week == day_of_week)
            .where(self.model.academic_term_id == academic_term_id)
            .where(self.model.deleted_at.is_(None))
            .where(self.model.is_active.is_(True))
            .options(*self._DEFAULT_OPTIONS)
            .order_by(Period.period_number)
            .join(Period, Period.id == self.model.period_id)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
