"""Repository for AcademicTerm model.

Provides CRUD operations for academic terms, scoped to a school.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic_term import AcademicTerm
from app.repository.base import BaseRepository


class AcademicTermRepository(BaseRepository[AcademicTerm]):
    """Repository for academic term management.

    Standard CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, AcademicTerm)

    async def get_current_term(self, academic_year_id: str) -> AcademicTerm | None:
        """Return the current term (is_current=True) within an academic year."""
        stmt = (
            select(self.model)
            .where(self.model.academic_year_id == academic_year_id)
            .where(self.model.is_current.is_(True))
            .where(self.model.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def validate_term(
        self, academic_year_id: str, term_id: str
    ) -> bool:
        """Check whether a term belongs to the given academic year and is active."""
        term = await self.get(term_id)
        if term is None:
            return False
        return str(term.academic_year_id) == academic_year_id
