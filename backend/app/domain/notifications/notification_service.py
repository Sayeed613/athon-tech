"""Notification service — business logic for notification management.

Provides:
    - Creating notifications with recipient targeting
    - Listing notifications for users
    - Marking notifications as read/unread
    - Future-ready multi-channel delivery support

All data access is delegated to ``NotificationRepository`` and
``NotificationRecipientRepository``.
"""

from datetime import datetime, timezone
from typing import Any

from app.models.enums import NotificationChannel, NotificationStatus, NotificationType
from app.models.notification import Notification
from app.repository.notification_recipient_repo import NotificationRecipientRepository
from app.repository.notification_repo import NotificationRepository


class NotificationService:
    """Service for notification management.

    Handles creation, delivery, and read tracking of notifications
    across multiple channels (in-app, email, WhatsApp future-ready).
    """

    def __init__(
        self,
        notification_repo: NotificationRepository,
        recipient_repo: NotificationRecipientRepository,
    ) -> None:
        self._notification_repo = notification_repo
        self._recipient_repo = recipient_repo

    async def create_notification(
        self,
        school_id: str,
        title: str,
        notification_type: NotificationType = NotificationType.ACADEMIC,
        body: str | None = None,
        sender_id: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
        scheduled_at: datetime | None = None,
    ) -> Notification:
        """Create a new notification record.

        Args:
            school_id: UUID of the school (tenant scope).
            title: Notification title.
            notification_type: Category of notification.
            body: Optional notification body text.
            sender_id: Optional sender user UUID (None for system).
            extra_metadata: Optional JSONB metadata payload.
            scheduled_at: Optional scheduled delivery time.

        Returns:
            The newly created ``Notification`` record.
        """
        return await self._notification_repo.create(
            school_id=school_id,
            sender_id=sender_id,
            notification_type=notification_type.value,
            title=title,
            body=body,
            metadata_=extra_metadata,
            scheduled_at=scheduled_at,
        )

    async def create_with_recipients(
        self,
        school_id: str,
        title: str,
        recipient_user_ids: list[str],
        notification_type: NotificationType = NotificationType.ACADEMIC,
        body: str | None = None,
        sender_id: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
        channel: NotificationChannel = NotificationChannel.EMAIL,
        scheduled_at: datetime | None = None,
    ) -> Notification:
        """Create a notification and add recipients in one call.

        Args:
            school_id: UUID of the school.
            title: Notification title.
            recipient_user_ids: List of user UUIDs to notify.
            notification_type: Category of notification.
            body: Optional notification body.
            sender_id: Optional sender UUID.
            extra_metadata: Optional JSONB metadata.
            channel: Delivery channel (default: email).
            scheduled_at: Optional scheduled time.

        Returns:
            The created ``Notification`` with recipients attached.
        """
        notification = await self.create_notification(
            school_id=school_id,
            title=title,
            notification_type=notification_type,
            body=body,
            sender_id=sender_id,
            extra_metadata=extra_metadata,
            scheduled_at=scheduled_at,
        )

        for user_id in recipient_user_ids:
            await self._recipient_repo.create(
                notification_id=str(notification.id),
                user_id=user_id,
                channel=channel.value,
                status=NotificationStatus.PENDING.value,
            )

        return notification

    async def get_user_notifications(
        self,
        user_id: str,
        school_id: str,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False,
    ) -> list[Notification]:
        """Get notifications for a user.

        Args:
            user_id: UUID of the user.
            school_id: UUID of the school.
            skip: Pagination offset.
            limit: Page size.
            unread_only: If True, only return unread notifications.

        Returns:
            A list of Notification records.
        """
        return await self._notification_repo.get_user_notifications(
            user_id=user_id,
            school_id=school_id,
            skip=skip,
            limit=limit,
            unread_only=unread_only,
        )

    async def count_unread(
        self,
        user_id: str,
        school_id: str,
    ) -> int:
        """Count unread notifications for a user."""
        return await self._notification_repo.count_user_notifications(
            user_id=user_id,
            school_id=school_id,
            unread_only=True,
        )

    async def mark_as_read(
        self,
        notification_id: str,
        user_id: str,
    ) -> bool:
        """Mark a single notification as read.

        Returns True if the notification was found and marked, False otherwise.
        """
        result = await self._recipient_repo.mark_as_read(
            notification_id=notification_id,
            user_id=user_id,
        )
        return result is not None

    async def mark_all_as_read(
        self,
        user_id: str,
        school_id: str,
    ) -> int:
        """Mark all notifications as read for a user.

        Returns the number of notifications marked as read.
        """
        return await self._recipient_repo.mark_all_as_read(
            user_id=user_id,
            school_id=school_id,
        )
