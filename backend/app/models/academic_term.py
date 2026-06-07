"""AcademicTerm model — terms within an academic year.

Homework, tests, and attendance are scoped to terms rather than full years
to enable term-by-term reporting and grade calculation.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class AcademicTerm(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "academic_terms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False,
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

    # ── Foreign Key Constraints (tables.sql section 16.3) ──
    # academic_year_id FK → academic_years(id)
    # school_id FK → schools(id)
    # UNIQUE(academic_year_id, name)
    # CHECK(end_date > start_date)

    # ── Relationships ───────────────────────────────────────────
    academic_year = relationship("AcademicYear", back_populates="terms")
    school = relationship("School", back_populates="academic_terms")
    teacher_class_subjects = relationship("TeacherClassSubject", back_populates="academic_term")
    timetable_entries = relationship("TimetableEntry", back_populates="academic_term")
    attendance_records = relationship("Attendance", back_populates="academic_term")
    homeworks = relationship("Homework", back_populates="academic_term")
    tests = relationship("Test", back_populates="academic_term")

    def __repr__(self) -> str:
        return f"<AcademicTerm {self.name}>"
