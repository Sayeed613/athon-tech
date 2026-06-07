"""Announcement model — school announcements with audience targeting.

Supports multiple audience types (school_wide, teachers_only, specific_classes)
and priority levels (low, normal, high, urgent). Announcements can be
scheduled (publish_at) and have expiration dates (expires_at).

Announcements automatically create Notifications via NotificationService
when published.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Announcement(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
    )
    body: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    audience_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="school_wide",
    )
    class_ids: Mapped[list | None] = mapped_column(
        JSONB, nullable=True,
    )
    priority: Mapped[str] = mapped_column(
        String(10), nullable=False, default="normal",
    )
    publish_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Foreign Key Constraints ──
    # school_id FK → schools(id)
    # sender_id FK → users(id)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="announcements")
    sender = relationship("User", back_populates="announcements")

    def __repr__(self) -> str:
        return f"<Announcement {self.title} [{self.audience_type}]>"
