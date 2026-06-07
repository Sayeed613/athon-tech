"""AcademicYear model — academic calendar years per school.

Defines the academic calendar years for each school (e.g. "2025-2026").
Each school manages its own academic years independently. is_current
flags the active year for simplified queries.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class AcademicYear(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "academic_years"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    start_date: Mapped[date] = mapped_column(
        Date, nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date, nullable=False,
    )
    is_current: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.2) ──
    # school_id FK → schools(id)
    # UNIQUE(school_id, name)
    # CHECK(end_date > start_date)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="academic_years")
    terms = relationship("AcademicTerm", back_populates="academic_year")
    classes = relationship("Class", back_populates="academic_year")
    class_enrollments = relationship("ClassEnrollment", back_populates="academic_year")

    def __repr__(self) -> str:
        return f"<AcademicYear {self.name}>"
