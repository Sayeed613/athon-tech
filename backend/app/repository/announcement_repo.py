"""Announcement repository — data access for school announcements.

Provides school-scoped CRUD with audience-based filtering, expiry
handling, and eager-loaded relationships.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.announcement import Announcement
from app.repository.base import BaseRepository


class AnnouncementRepository(BaseRepository[Announcement]):
    """Repository for Announcement records.

    Automatically filters out soft-deleted and expired announcements
    in active queries.
    """

    _DEFAULT_OPTIONS = (
        selectinload(Announcement.sender),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Announcement)

    def _active_query(self):  # type: ignore[override]
        """Override to also filter out expired announcements."""
        now = datetime.now(timezone.utc)
        q = select(self.model).where(self.model.deleted_at.is_(None))
        q = q.where(
            (self.model.expires_at.is_(None)) | (self.model.expires_at > now)
        )
        return q

    async def get_school_announcements(
        self,
        school_id: str,
        skip: int = 0,
        limit: int = 50,
        include_unpublished: bool = False,
        audience_type: str | None = None,
    ) -> list[Announcement]:
        """Fetch announcements for a school.

        Args:
            school_id: UUID of the school.
            skip: Pagination offset.
            limit: Page size.
            include_unpublished: If True, include draft announcements.
            audience_type: Optional filter by audience type.

        Returns:
            A list of Announcement records ordered by created_at descending.
        """
        query = (
            self._active_query()
            .where(Announcement.school_id == school_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if not include_unpublished:
            query = query.where(Announcement.is_published.is_(True))

        if audience_type:
            query = query.where(Announcement.audience_type == audience_type)

        query = query.order_by(Announcement.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_visible_for_user(
        self,
        school_id: str,
        user_role: str,
        class_ids: list[str] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[Announcement]:
        """Fetch announcements visible to a specific user based on role.

        Rules:
            - school_wide: visible to all
            - teachers_only: visible only to teachers/principals/admins
            - specific_classes: visible to students/teachers in those classes

        Args:
            school_id: UUID of the school.
            user_role: Role of the user (student, teacher, principal, etc.).
            class_ids: Class IDs the user belongs to (for student/teacher filtering).
            skip: Pagination offset.
            limit: Page size.

        Returns:
            A list of matching Announcement records.
        """
        query = (
            self._active_query()
            .where(Announcement.school_id == school_id)
            .where(Announcement.is_published.is_(True))
            .options(*self._DEFAULT_OPTIONS)
        )

        # Filter by audience type based on user role
        if user_role in ("student", "parent"):
            # Students/parents see school_wide + their own classes
            from sqlalchemy import or_

            conditions = [Announcement.audience_type == "school_wide"]
            if class_ids:
                for cid in class_ids:
                    conditions.append(
                        Announcement.class_ids.contains(cid)
                    )
            query = query.where(or_(*conditions))

        elif user_role == "teacher":
            # Teachers see school_wide, teachers_only, and their own classes
            from sqlalchemy import or_

            conditions = [
                Announcement.audience_type.in_(["school_wide", "teachers_only"]),
            ]
            if class_ids:
                for cid in class_ids:
                    conditions.append(
                        Announcement.class_ids.contains(cid)
                    )
            query = query.where(or_(*conditions))

        # Principals/admins see everything

        query = query.order_by(Announcement.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())
