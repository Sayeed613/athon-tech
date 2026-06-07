"""User repository — data access for unified auth principals.

All queries respect soft-delete filtering inherited from BaseRepository.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repository.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
        - get_multi_paginated() for paginated listing

    Provides specialised lookups by email (for admin CRUD checks)
    and by supabase_user_id (for auth flow).
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, User)

    async def get_by_email(self, email: str) -> User | None:
        """Fetch a user by email address."""
        query = self._active_query().where(User.email == email)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_supabase_id(self, supabase_user_id: str) -> User | None:
        """Fetch a user by Supabase Auth user ID."""
        query = self._active_query().where(
            User.supabase_user_id == supabase_user_id
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        """Check if a user with the given email already exists."""
        user = await self.get_by_email(email)
        return user is not None
