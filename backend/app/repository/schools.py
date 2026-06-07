"""School repository — data access for school profiles and settings."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.school import School
from app.repository.base import BaseRepository


class SchoolRepository(BaseRepository[School]):
    """Repository for School records.

    CRUD inherited from BaseRepository:
        - create(), get(), get_multi(), update(), soft_delete(), hard_delete()
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, School)
