"""Notification model — outbound notification records.

A notification represents a message sent to one or more recipients
through various channels. sender_id is NULL for system-triggered
notifications. Individual delivery tracking is in notification_recipients.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(
            NotificationType,
            name="notification_type",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=NotificationType.ACADEMIC.value,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
    )
    body: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True,
    )
    is_sent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.26) ──
    # school_id FK → schools(id)
    # sender_id FK → users(id) (nullable)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="notifications")
    sender = relationship("User", back_populates="sent_notifications")
    recipients = relationship(
        "NotificationRecipient", back_populates="notification",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Notification {self.notification_type}: {self.title}>"
