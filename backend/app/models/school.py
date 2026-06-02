"""School model — tenant root entity.

Each school is a separate tenant. All tenant-scoped tables reference
schools via school_id. Schools have unique code and optional domain
for white-label portals. The settings JSONB column stores flexible
school-level configuration (grading scales, term structures, etc.)
without requiring schema migrations.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class School(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
    )
    domain: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True,
    )
    logo_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
    )
    settings: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default="{}",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )

    # ── Relationships ───────────────────────────────────────────
    users = relationship("User", back_populates="school")
    teachers = relationship("Teacher", back_populates="school")
    principals = relationship("Principal", back_populates="school")
    parents = relationship("Parent", back_populates="school")
    students = relationship("Student", back_populates="school")

    def __repr__(self) -> str:
        return f"<School {self.code}: {self.name}>"
