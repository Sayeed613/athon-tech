"""Announcement Pydantic schemas for request/response serialisation.

These schemas mirror the Announcement ORM model and provide structured
representations for API consumers.
"""

from __future__ import annotations

import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AudienceTypeEnum(str, Enum):
    """Target audience for announcements."""

    SCHOOL_WIDE = "school_wide"
    TEACHERS_ONLY = "teachers_only"
    SPECIFIC_CLASSES = "specific_classes"


class PriorityEnum(str, Enum):
    """Priority level for announcements."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# ── Request Schemas ─────────────────────────────────────────────


class CreateAnnouncementRequest(BaseModel):
    """Request body for creating an announcement."""

    title: str = Field(..., min_length=1, max_length=200, description="Announcement title")
    body: str | None = Field(None, max_length=10000, description="Announcement body")
    audience_type: AudienceTypeEnum = Field(
        AudienceTypeEnum.SCHOOL_WIDE, description="Target audience"
    )
    class_ids: list[str] | None = Field(
        None, description="Class UUIDs (required for specific_classes audience)"
    )
    priority: PriorityEnum = Field(
        PriorityEnum.NORMAL, description="Priority level"
    )
    publish_at: datetime.datetime | None = Field(
        None, description="Scheduled publish time (ISO 8601)"
    )
    expires_at: datetime.datetime | None = Field(
        None, description="Expiration time (ISO 8601)"
    )
    is_published: bool = Field(
        False, description="Publish immediately"
    )


class UpdateAnnouncementRequest(BaseModel):
    """Request body for updating an announcement."""

    title: str | None = Field(None, min_length=1, max_length=200, description="Announcement title")
    body: str | None = Field(None, max_length=10000, description="Announcement body")
    audience_type: AudienceTypeEnum | None = Field(None, description="Target audience")
    class_ids: list[str] | None = Field(None, description="Class UUIDs")
    priority: PriorityEnum | None = Field(None, description="Priority level")
    publish_at: datetime.datetime | None = Field(None, description="Scheduled publish time")
    expires_at: datetime.datetime | None = Field(None, description="Expiration time")
    is_published: bool | None = Field(None, description="Publish immediately")


# ── Response Schemas ────────────────────────────────────────────


class SenderInfo(BaseModel):
    """Nested sender info in announcement responses."""

    id: str = Field(..., description="Sender user UUID")
    first_name: str = Field(..., description="Sender's first name")
    last_name: str = Field(..., description="Sender's last name")
    role: str = Field(..., description="Sender's role")


class AnnouncementResponse(BaseModel):
    """Standard announcement response."""

    id: str = Field(..., description="Announcement UUID")
    school_id: str = Field(..., description="School UUID")
    sender_id: str = Field(..., description="Sender user UUID")
    title: str = Field(..., description="Announcement title")
    body: str | None = None
    audience_type: str = Field(..., description="Target audience")
    class_ids: list[str] | None = Field(None, description="Target class UUIDs")
    priority: str = Field(..., description="Priority level")
    publish_at: datetime.datetime | None = None
    expires_at: datetime.datetime | None = None
    is_published: bool = Field(..., description="Whether published")
    published_at: datetime.datetime | None = None
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")

    # Nested info
    sender: SenderInfo | None = None


class AnnouncementListResponse(BaseModel):
    """Wrapper for a list of announcements."""

    announcements: list[AnnouncementResponse] = Field(
        ..., description="List of announcements"
    )
    total: int = Field(0, description="Total number of announcements")
