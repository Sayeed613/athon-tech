"""Notification API endpoints — send, list, and manage notifications.

All endpoints require authentication. Role-based access control ensures:
    - Teachers/admins can send notifications
    - Users can list their own notifications
    - Users can mark their notifications as read

All data access is delegated to ``NotificationService``.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.notifications import (
    NotificationListResponse,
    NotificationResponse,
    RecipientInfo,
    SendNotificationRequest,
    UnreadCountResponse,
)
from app.core.database import get_db
from app.domain.notifications.notification_service import NotificationService
from app.models.notification import Notification
from app.models.notification_recipient import NotificationRecipient
from app.models.user import User
from app.repository.notification_recipient_repo import NotificationRecipientRepository
from app.repository.notification_repo import NotificationRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["notifications"])


# ── Helper Functions ────────────────────────────────────────────


def _build_notification_response(
    notification: Notification,
    current_user_id: str | None = None,
) -> NotificationResponse:
    """Convert a Notification ORM instance to a response schema.

    If ``current_user_id`` is provided, attaches the recipient info
    for the current user (read status, delivery status, etc.).
    """
    resp = NotificationResponse(
        id=str(notification.id),
        school_id=str(notification.school_id),
        sender_id=str(notification.sender_id) if notification.sender_id else None,
        notification_type=(
            notification.notification_type.value
            if hasattr(notification.notification_type, "value")
            else str(notification.notification_type)
        ),
        title=notification.title,
        body=notification.body,
        metadata=notification.metadata_ if hasattr(notification, 'metadata_') else None,
        is_sent=notification.is_sent,
        sent_at=notification.sent_at,
        scheduled_at=notification.scheduled_at,
        created_at=notification.created_at.isoformat() if notification.created_at else "",
    )

    # Attach recipient info for the current user
    if current_user_id and hasattr(notification, "recipients"):
        for recipient in notification.recipients:
            if str(recipient.user_id) == current_user_id:
                resp.recipient = RecipientInfo(
                    user_id=str(recipient.user_id) if recipient.user_id else None,
                    channel=(
                        recipient.channel.value
                        if hasattr(recipient.channel, "value")
                        else str(recipient.channel)
                    ),
                    status=(
                        recipient.status.value
                        if hasattr(recipient.status, "value")
                        else str(recipient.status)
                    ),
                    is_read=recipient.is_read,
                    read_at=recipient.read_at,
                    delivered_at=recipient.delivered_at,
                )
                break

    return resp


# ── Service Factory ─────────────────────────────────────────────


def _build_service(db: AsyncSession) -> NotificationService:
    """Build a NotificationService with its repository dependencies."""
    return NotificationService(
        notification_repo=NotificationRepository(db),
        recipient_repo=NotificationRecipientRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/notifications/send",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_notification(
    body: SendNotificationRequest,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create and send a notification to specified recipients.

    Accessible by teachers, principals, and school admins.
    System notifications (sender_id=null) can only be created by admins.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    # Only admins can send system-triggered notifications
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )
    sender_id = str(current_user.id) if role_str != "super_admin" else None

    notification = await service.create_with_recipients(
        school_id=school_id,
        title=body.title,
        recipient_user_ids=body.recipient_user_ids,
        notification_type=body.notification_type,
        body=body.body,
        sender_id=sender_id,
        extra_metadata=body.metadata,
        scheduled_at=body.scheduled_at,
    )

    return _build_notification_response(notification)


@router.get(
    "/notifications/me",
    response_model=NotificationListResponse,
)
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(50, ge=1, le=200, description="Max notifications to return"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
):
    """Get notifications for the authenticated user.

    Returns the user's notifications with read/unread tracking.
    """
    service = _build_service(db)
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    notifications = await service.get_user_notifications(
        user_id=user_id,
        school_id=school_id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )

    unread_count = await service.count_unread(
        user_id=user_id,
        school_id=school_id,
    )

    return NotificationListResponse(
        notifications=[
            _build_notification_response(n, current_user_id=user_id)
            for n in notifications
        ],
        total=len(notifications),
        unread_count=unread_count,
    )


@router.get(
    "/notifications/unread/count",
    response_model=UnreadCountResponse,
)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the count of unread notifications for the authenticated user."""
    service = _build_service(db)
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    count = await service.count_unread(
        user_id=user_id,
        school_id=school_id,
    )

    return UnreadCountResponse(count=count)


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=dict,
)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read."""
    service = _build_service(db)
    user_id = str(current_user.id)

    success = await service.mark_as_read(
        notification_id=notification_id,
        user_id=user_id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found or not addressed to this user",
        )

    return {"status": "ok", "message": "Marked as read"}


@router.post(
    "/notifications/read-all",
    response_model=dict,
)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the authenticated user."""
    service = _build_service(db)
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    count = await service.mark_all_as_read(
        user_id=user_id,
        school_id=school_id,
    )

    return {
        "status": "ok",
        "message": f"Marked {count} notifications as read",
        "count": count,
    }
