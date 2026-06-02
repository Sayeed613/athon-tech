"""Principal model — principal-specific profile (first-class role).

Principals have distinct permissions, dashboards, and profile information
from teachers. This is a separate table (not a flag on teachers) because
principals have fundamentally different permissions, dashboards, and
profile fields (appointment_type, tenure dates).

appointment_type: permanent, acting, interim, etc.
tenure_end_date: NULL while the principal is currently serving.
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Principal(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "principals"

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
    employee_code: Mapped[str] = mapped_column(
        String(30), nullable=False,
    )
    qualification: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
    )
    appointment_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="permanent",
    )
    tenure_start_date: Mapped[date] = mapped_column(
        Date, nullable=False,
    )
    tenure_end_date: Mapped[date | None] = mapped_column(
        Date, nullable=True,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.8) ──
    # user_id FK → users(id), UNIQUE
    # school_id FK → schools(id)

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="principal")
    school = relationship("School", back_populates="principals")

    def __repr__(self) -> str:
        return f"<Principal {self.employee_code}>"
