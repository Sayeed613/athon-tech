"""NotificationRecipient model — per-recipient delivery tracking.

Each notification can target multiple recipients through different channels.
contact_address stores the actual email or phone number used for delivery.
CHECK constraint ensures exactly one of user_id or parent_id is set.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import NotificationChannel, NotificationStatus


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parents.id"), nullable=True,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        SAEnum(
            NotificationChannel,
            name="notification_channel",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=NotificationChannel.EMAIL.value,
    )
    contact_address: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        SAEnum(
            NotificationStatus,
            name="notification_status",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=NotificationStatus.PENDING.value,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.27) ──
    # notification_id FK → notifications(id) ON DELETE CASCADE
    # user_id FK → users(id) (nullable)
    # parent_id FK → parents(id) (nullable)
    # CHECK(user_id IS NOT NULL AND parent_id IS NULL OR ...)

    # ── Relationships ───────────────────────────────────────────
    notification = relationship("Notification", back_populates="recipients")
    user = relationship("User", back_populates="notification_recipients")

    def __repr__(self) -> str:
        return f"<NotificationRecipient {self.channel}: {self.status}>"
