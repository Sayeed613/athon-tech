"""Parent model — parent/guardian profile extending the users table.

1:1 relationship with User via user_id. is_verified tracks whether
the parent identity has been confirmed. The actual student-parent
relationship (which children belong to which parent) is modeled
in the student_parents junction table.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Parent(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "parents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    occupation: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.9) ──
    # user_id FK → users(id), UNIQUE
    # school_id FK → schools(id)

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="parent")
    school = relationship("School", back_populates="parents")
    student_parents = relationship("StudentParent", back_populates="parent")

    def __repr__(self) -> str:
        return f"<Parent user_id={self.user_id}>"
