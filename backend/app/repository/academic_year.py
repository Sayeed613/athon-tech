"""Repository for AcademicYear model.

Provides CRUD operations for academic calendar years, scoped to a school.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic_year import AcademicYear
from app.repository.base import BaseRepository


class AcademicYearRepository(BaseRepository[AcademicYear]):
    """Repository for academic year management.

    Standard CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, AcademicYear)

    async def get_current_year(self, school_id: str) -> AcademicYear | None:
        """Return the current academic year (is_current=True) for a school."""
        stmt = (
            select(self.model)
            .where(self.model.school_id == school_id)
            .where(self.model.is_current.is_(True))
            .where(self.model.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_year(self, school_id: str) -> AcademicYear | None:
        """Return the most recently created active academic year for a school."""
        from sqlalchemy import desc

        stmt = (
            select(self.model)
            .where(self.model.school_id == school_id)
            .where(self.model.deleted_at.is_(None))
            .order_by(desc(self.model.created_at))
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
