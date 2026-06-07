"""Principal repository — data access for principal profiles.

All queries are school-scoped and respect soft-delete filtering
inherited from BaseRepository.
"""

from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.principal import Principal
from app.models.user import User
from app.repository.base import BaseRepository


class PrincipalRepository(BaseRepository[Principal]):
    """Repository for Principal records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Principal)

    async def get_by_user_id(self, user_id: str) -> Principal | None:
        """Fetch a principal record by the associated user_id."""
        query = self._active_query().where(Principal.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_user(self, principal_id: str) -> Principal | None:
        """Fetch a principal with the associated User eagerly loaded."""
        query = (
            self._active_query()
            .where(Principal.id == principal_id)
            .options(selectinload(Principal.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def search_by_name(
        self,
        school_id: str,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Principal], int]:
        """Search principals by name or employee_code within a school.

        Returns a tuple of (principals_list, total_count).
        """
        # Always join User for ordering
        base_query = (
            self._active_query()
            .join(Principal.user)
            .where(Principal.school_id == school_id)
        )

        if search:
            pattern = f"%{search}%"
            base_query = base_query.where(
                User.first_name.ilike(pattern)
                | User.last_name.ilike(pattern)
                | Principal.employee_code.ilike(pattern)
            )

        # Count total
        count_query = select(sa_func.count()).select_from(base_query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        # Fetch paginated
        query = base_query
        query = query.order_by(User.first_name).offset(skip).limit(limit)
        result = await self.db.execute(query)

        return list(result.scalars().all()), total
