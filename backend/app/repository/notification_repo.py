"""Notification repository — data access for notification records.

Provides school-scoped CRUD plus queries for listing notifications
by recipient with read/unread tracking.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification import Notification
from app.repository.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """Repository for Notification records.

    The Notification model has no ``deleted_at`` column, so the
    soft-delete filter is automatically disabled.
    """

    _DEFAULT_OPTIONS = (
        selectinload(Notification.sender),
        selectinload(Notification.recipients),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Notification)

    async def get_user_notifications(
        self,
        user_id: str,
        school_id: str,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False,
    ) -> list[Notification]:
        """Fetch notifications for a user via the notification_recipients junction.

        Args:
            user_id: UUID of the user.
            school_id: UUID of the school (tenant scope).
            skip: Number of records to skip (pagination).
            limit: Maximum number of records to return.
            unread_only: If True, only return unread notifications.

        Returns:
            A list of Notification records ordered by created_at descending.
        """
        from app.models.notification_recipient import NotificationRecipient

        query = (
            select(Notification)
            .join(NotificationRecipient)
            .where(NotificationRecipient.user_id == user_id)
            .where(Notification.school_id == school_id)
            .options(
                selectinload(Notification.sender),
                selectinload(Notification.recipients),
            )
        )

        if unread_only:
            query = query.where(NotificationRecipient.is_read.is_(False))

        query = query.order_by(Notification.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_user_notifications(
        self,
        user_id: str,
        school_id: str,
        unread_only: bool = False,
    ) -> int:
        """Count notifications for a user.

        Args:
            user_id: UUID of the user.
            school_id: UUID of the school (tenant scope).
            unread_only: If True, only count unread notifications.

        Returns:
            The total count of notifications matching the criteria.
        """
        from app.models.notification_recipient import NotificationRecipient

        query = (
            select(func.count())
            .select_from(Notification)
            .join(NotificationRecipient)
            .where(NotificationRecipient.user_id == user_id)
            .where(Notification.school_id == school_id)
        )

        if unread_only:
            query = query.where(NotificationRecipient.is_read.is_(False))

        result = await self.db.execute(query)
        return result.scalar_one()
