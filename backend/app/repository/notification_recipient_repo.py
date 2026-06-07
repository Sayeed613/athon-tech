"""Notification recipient repository — per-recipient delivery tracking.

Provides queries for marking notifications as read and retrieving
recipient-specific delivery status.
"""

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_recipient import NotificationRecipient
from app.repository.base import BaseRepository


class NotificationRecipientRepository(BaseRepository[NotificationRecipient]):
    """Repository for NotificationRecipient records.

    The NotificationRecipient model has no ``deleted_at`` column,
    so the soft-delete filter is automatically disabled.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, NotificationRecipient)

    async def get_by_notification_and_user(
        self,
        notification_id: str,
        user_id: str,
    ) -> NotificationRecipient | None:
        """Get a specific recipient record for a notification and user."""
        query = (
            select(NotificationRecipient)
            .where(NotificationRecipient.notification_id == notification_id)
            .where(NotificationRecipient.user_id == user_id)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def mark_as_read(
        self,
        notification_id: str,
        user_id: str,
    ) -> NotificationRecipient | None:
        """Mark a notification as read for a specific user.

        Returns the updated recipient record, or None if not found.
        """
        recipient = await self.get_by_notification_and_user(
            notification_id=notification_id,
            user_id=user_id,
        )
        if recipient is None:
            return None

        now = datetime.now(timezone.utc)
        return await self.update(
            recipient.id,
            is_read=True,
            read_at=now,
        )

    async def mark_all_as_read(
        self,
        user_id: str,
        school_id: str,
    ) -> int:
        """Mark all unread notifications as read for a user.

        Args:
            user_id: UUID of the user.
            school_id: UUID of the school (tenant scope).

        Returns:
            The number of records marked as read.
        """
        from app.models.notification import Notification

        now = datetime.now(timezone.utc)

        # Get IDs of recipient records to update
        subquery = (
            select(NotificationRecipient.id)
            .join(Notification)
            .where(NotificationRecipient.user_id == user_id)
            .where(Notification.school_id == school_id)
            .where(NotificationRecipient.is_read.is_(False))
        ).subquery()

        stmt = (
            update(NotificationRecipient)
            .where(NotificationRecipient.id.in_(select(subquery.c.id)))  # type: ignore[union-attr]
            .values(is_read=True, read_at=now)
        )
        result = await self.db.execute(stmt)
        return result.rowcount  # type: ignore[return-value]
