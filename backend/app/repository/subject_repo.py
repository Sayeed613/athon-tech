"""Repository for Subject model.

Provides CRUD operations for academic subjects with specialised
query for core/compulsory subjects.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Subject
from app.repository.base import BaseRepository


class SubjectRepository(BaseRepository[Subject]):
    """Repository for subject management.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Subject)

    async def get_core_subjects(self, school_id: str) -> list[Subject]:
        """Return all core/compulsory subjects for a school.

        Core subjects are those with ``is_core = TRUE``. Results are
        ordered alphabetically by subject name.
        """
        query = (
            select(self.model)
            .where(self.model.school_id == school_id)
            .where(self.model.is_core.is_(True))
            .where(self.model.deleted_at.is_(None))
            .order_by(self.model.name)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
