"""Announcement service — business logic for school announcements.

Provides:
    - Creating announcements with audience targeting
    - Listing announcements with role-based visibility
    - Updating and deleting announcements
    - Automatic notification creation for recipients

Integrates with ``NotificationService`` to create notifications
when announcements are published.
"""

from datetime import datetime, timezone

from app.domain.notifications.notification_service import NotificationService
from app.models.announcement import Announcement
from app.models.enums import NotificationType
from app.repository.announcement_repo import AnnouncementRepository


class AnnouncementService:
    """Service for announcement management.

    Handles the full lifecycle of announcements with audience targeting,
    role-based permissions, and automatic notification integration.
    """

    def __init__(
        self,
        announcement_repo: AnnouncementRepository,
        notification_service: NotificationService,
    ) -> None:
        self._announcement_repo = announcement_repo
        self._notification_service = notification_service

    async def create_announcement(
        self,
        school_id: str,
        sender_id: str,
        title: str,
        audience_type: str = "school_wide",
        body: str | None = None,
        class_ids: list[str] | None = None,
        priority: str = "normal",
        publish_at: datetime | None = None,
        expires_at: datetime | None = None,
        is_published: bool = False,
        recipient_user_ids: list[str] | None = None,
    ) -> Announcement:
        """Create a new announcement.

        Args:
            school_id: UUID of the school.
            sender_id: UUID of the sender (user).
            title: Announcement title.
            audience_type: Target audience (school_wide, teachers_only, specific_classes).
            body: Optional announcement body.
            class_ids: List of class UUIDs (required for specific_classes audience).
            priority: Priority level (low, normal, high, urgent).
            publish_at: Optional scheduled publish time.
            expires_at: Optional expiration time.
            is_published: Whether to publish immediately.
            recipient_user_ids: Pre-resolved user IDs to notify. If provided
                and the announcement is published, notifications are created
                automatically via NotificationService.

        Returns:
            The newly created ``Announcement`` record.
        """
        now = datetime.now(timezone.utc)

        announcement = await self._announcement_repo.create(
            school_id=school_id,
            sender_id=sender_id,
            title=title,
            body=body,
            audience_type=audience_type,
            class_ids=class_ids,
            priority=priority,
            publish_at=publish_at,
            expires_at=expires_at,
            is_published=is_published,
            published_at=now if is_published else None,
        )

        # Automatically create notifications if published with known recipients
        if is_published and recipient_user_ids:
            await self._create_notifications_for_announcement(
                announcement, recipient_user_ids,
            )

        return announcement

    async def _create_notifications_for_announcement(
        self,
        announcement: Announcement,
        recipient_user_ids: list[str],
    ) -> None:
        """Create notifications for all recipients of an announcement.

        Args:
            announcement: The published Announcement record.
            recipient_user_ids: Pre-resolved list of user UUIDs to notify.
        """
        from app.models.enums import NotificationChannel, NotificationType

        await self._notification_service.create_with_recipients(
            school_id=str(announcement.school_id),
            title=f"New announcement: {announcement.title}",
            body=announcement.body or announcement.title,
            recipient_user_ids=recipient_user_ids,
            notification_type=NotificationType.ACADEMIC,
            sender_id=str(announcement.sender_id),
            extra_metadata={
                "announcement_id": str(announcement.id),
                "audience_type": announcement.audience_type,
                "priority": announcement.priority,
            },
            channel=NotificationChannel.IN_APP,
        )

    async def publish_announcement(
        self,
        announcement_id: str,
        recipient_user_ids: list[str] | None = None,
    ) -> Announcement | None:
        """Publish a draft announcement and create notifications."""
        announcement = await self._announcement_repo.get(announcement_id)
        if announcement is None:
            return None

        if announcement.is_published:
            return announcement

        now = datetime.now(timezone.utc)
        updated = await self._announcement_repo.update(
            announcement_id,
            is_published=True,
            published_at=now,
        )

        if updated and recipient_user_ids:
            await self._create_notifications_for_announcement(
                updated, recipient_user_ids,
            )

        return updated

    async def get_announcements(
        self,
        school_id: str,
        user_role: str,
        class_ids: list[str] | None = None,
        skip: int = 0,
        limit: int = 50,
        include_unpublished: bool = False,
    ) -> list[Announcement]:
        """Get announcements visible to a user.

        For principals/admins: returns all announcements (optionally including drafts).
        For teachers: returns school_wide, teachers_only, and their class announcements.
        For students/parents: returns school_wide and their class announcements.
        """
        if user_role in ("principal", "school_admin", "super_admin"):
            return await self._announcement_repo.get_school_announcements(
                school_id=school_id,
                skip=skip,
                limit=limit,
                include_unpublished=include_unpublished,
            )

        return await self._announcement_repo.get_visible_for_user(
            school_id=school_id,
            user_role=user_role,
            class_ids=class_ids,
            skip=skip,
            limit=limit,
        )

    async def get_announcement(
        self,
        announcement_id: str,
    ) -> Announcement | None:
        """Get a single announcement by ID."""
        return await self._announcement_repo.get(announcement_id)

    async def update_announcement(
        self,
        announcement_id: str,
        **kwargs: object,
    ) -> Announcement | None:
        """Update an announcement."""
        return await self._announcement_repo.update(announcement_id, **kwargs)

    async def delete_announcement(
        self,
        announcement_id: str,
    ) -> bool:
        """Soft-delete an announcement.

        Returns True if deleted, False if not found.
        """
        result = await self._announcement_repo.soft_delete(announcement_id)
        return result is not None
