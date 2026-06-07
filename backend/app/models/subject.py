"""Subject model — academic subjects offered at each school.

Subjects are scoped to a school (e.g. "Mathematics", "Physics").
is_core distinguishes core/compulsory from elective subjects.
Both code and name must be unique per school.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Subject(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False,
    )
    code: Mapped[str] = mapped_column(
        String(20), nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    is_core: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )

    # ── Foreign Key Constraints (tables.sql section 16.11) ──
    # school_id FK → schools(id)
    # UNIQUE(school_id, code), UNIQUE(school_id, name)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="subjects")
    teacher_class_subjects = relationship("TeacherClassSubject", back_populates="subject")
    timetable_entries = relationship("TimetableEntry", back_populates="subject")
    homeworks = relationship("Homework", back_populates="subject")
    tests = relationship("Test", back_populates="subject")

    def __repr__(self) -> str:
        return f"<Subject {self.code}: {self.name}>"
