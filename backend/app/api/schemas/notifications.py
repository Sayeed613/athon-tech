"""Notification Pydantic schemas for request/response serialisation.

These schemas mirror the Notification and NotificationRecipient ORM
models and provide structured representations for API consumers.
"""

from __future__ import annotations

import datetime
from enum import Enum

from pydantic import BaseModel, Field


class NotificationTypeEnum(str, Enum):
    """Matches the notification_type PostgreSQL ENUM type."""

    ACADEMIC = "academic"
    ATTENDANCE = "attendance"
    FEE_REMINDER = "fee_reminder"
    ANNOUNCEMENT = "announcement"
    BEHAVIORAL = "behavioral"
    EMERGENCY = "emergency"
    SYSTEM = "system"
    OTHER = "other"


# ── Request Schemas ─────────────────────────────────────────────


class SendNotificationRequest(BaseModel):
    """Request body for creating and sending a notification."""

    title: str = Field(..., min_length=1, max_length=200, description="Notification title")
    body: str | None = Field(None, max_length=5000, description="Notification body")
    notification_type: NotificationTypeEnum = Field(
        NotificationTypeEnum.ACADEMIC, description="Category of notification"
    )
    recipient_user_ids: list[str] = Field(
        ..., min_length=1, max_length=500,
        description="List of user UUIDs to notify",
    )
    metadata: dict | None = Field(
        None, description="Optional metadata payload (JSONB)"
    )
    scheduled_at: datetime.datetime | None = Field(
        None, description="Optional scheduled delivery time"
    )


# ── Response Schemas ────────────────────────────────────────────


class RecipientInfo(BaseModel):
    """Nested recipient info in notification responses."""

    user_id: str | None = Field(None, description="User UUID")
    channel: str = Field(..., description="Delivery channel")
    status: str = Field(..., description="Delivery status")
    is_read: bool = Field(False, description="Whether the notification was read")
    read_at: datetime.datetime | None = Field(None, description="When read")
    delivered_at: datetime.datetime | None = Field(None, description="When delivered")


class NotificationResponse(BaseModel):
    """Standard notification response."""

    id: str = Field(..., description="Notification UUID")
    school_id: str = Field(..., description="School UUID")
    sender_id: str | None = Field(None, description="Sender user UUID (null for system)")
    notification_type: NotificationTypeEnum = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    body: str | None = None
    metadata: dict | None = None
    is_sent: bool = Field(False, description="Whether the notification was sent")
    sent_at: datetime.datetime | None = None
    scheduled_at: datetime.datetime | None = None
    created_at: str = Field(..., description="ISO 8601 creation timestamp")

    # Nested recipient info (for current user)
    recipient: RecipientInfo | None = None


class NotificationListResponse(BaseModel):
    """Wrapper for a list of notifications."""

    notifications: list[NotificationResponse] = Field(
        ..., description="List of notifications"
    )
    total: int = Field(0, description="Total number of notifications matching the query")
    unread_count: int = Field(0, description="Number of unread notifications")


class UnreadCountResponse(BaseModel):
    """Response for the unread count endpoint."""

    count: int = Field(0, description="Number of unread notifications")
