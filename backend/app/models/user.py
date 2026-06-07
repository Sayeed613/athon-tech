"""User model — unified authentication principal for all roles.

Serves as the single auth principal for super_admin, school_admin,
principal, teacher, student, and parent roles. Uses CITEXT for
case-insensitive email storage (handled at the database level).

Role-specific profile extensions (Teacher, Principal, Parent, Student)
use 1:1 relationships via user_id.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin
from app.models.enums import UserRole


class User(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(200), nullable=False,  # CITEXT at DB level
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    supabase_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    locale: Mapped[str] = mapped_column(
        String(10), nullable=False, default="en",
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True,
    )

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="users")

    # 1:1 role-specific profiles
    teacher = relationship("Teacher", back_populates="user", uselist=False)
    principal = relationship("Principal", back_populates="user", uselist=False)
    parent = relationship("Parent", back_populates="user", uselist=False)
    student = relationship("Student", back_populates="user", uselist=False)

    # Notifications
    sent_notifications = relationship("Notification", back_populates="sender")
    notification_recipients = relationship("NotificationRecipient", back_populates="user")
    announcements = relationship("Announcement", back_populates="sender")

    # Audit & AI
    audit_logs = relationship("AuditLog", back_populates="user")
    ai_generations = relationship("AiGeneration", back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.email}: {self.role.value if hasattr(self.role, 'value') else self.role}>"
