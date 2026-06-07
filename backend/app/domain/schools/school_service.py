"""School service — business logic for school profile and settings management."""

import logging
from typing import Any

from app.models.school import School
from app.repository.schools import SchoolRepository

logger = logging.getLogger("athon")


class SchoolService:
    """Service for school profile management."""

    def __init__(self, school_repo: SchoolRepository) -> None:
        self._school_repo = school_repo

    async def get_school(self, school_id: str) -> School | None:
        """Get school by ID."""
        return await self._school_repo.get(school_id)

    async def update_school(
        self, school_id: str, **kwargs: Any
    ) -> School | None:
        """Update school profile fields.

        Args:
            school_id: UUID of the school.
            **kwargs: Fields to update (name, address, phone, email,
                logo_url, settings, etc.).

        Returns:
            The updated School record, or None if not found.
        """
        return await self._school_repo.update(school_id, **kwargs)
