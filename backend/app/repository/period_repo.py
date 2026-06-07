"""Repository for Period model.

Provides CRUD operations for school day time slots.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.period import Period
from app.repository.base import BaseRepository


class PeriodRepository(BaseRepository[Period]):
    """Repository for school day period management.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Period)
