"""Parent repository — data access for parent profile management."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.parent import Parent
from app.models.user import User
from app.repository.base import BaseRepository


class ParentRepository(BaseRepository[Parent]):
    """Repository for Parent records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Parent)

    async def get_with_user(self, parent_id: str) -> Parent | None:
        """Fetch a parent with the User relation eagerly loaded."""
        query = (
            self._active_query()
            .where(Parent.id == parent_id)
            .options(selectinload(Parent.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def search_by_name(
        self,
        school_id: str,
        search: str | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Parent], int]:
        """Search parents by name/email with optional status filter.

        Returns:
            Tuple of (parents_list, total_count).
        """
        # Base query joined with User for search
        base_query = (
            self._active_query()
            .join(User, Parent.user_id == User.id)
            .where(Parent.school_id == school_id)
        )

        # Apply search filter
        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                )
            )

        # Apply active status filter
        if is_active is not None:
            base_query = base_query.where(User.is_active == is_active)

        # Count total
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()

        # Fetch paginated results with eager-loaded User
        query = (
            base_query
            .options(selectinload(Parent.user))
            .order_by(User.first_name, User.last_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        parents = list(result.scalars().all())

        return parents, total

    async def get_by_user_id(self, user_id: str) -> Parent | None:
        """Get a parent profile by user_id (1:1 relationship)."""
        query = self._active_query().where(Parent.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
