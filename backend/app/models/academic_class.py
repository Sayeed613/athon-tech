"""Class model — class groups.

Represents a cohort group (e.g. "Grade 10" section "A"). The combination
of name + section + academic_year uniquely identifies a class per school.
class_teacher_id (form teacher) is optional. capacity limits the maximum
number of students (1–100).
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Class(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "classes"

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
    section: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False,
    )
    class_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=True,
    )
    room_number: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    capacity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30,
    )

    # ── Foreign Key Constraints (tables.sql section 16.10) ──
    # school_id FK → schools(id)
    # academic_year_id FK → academic_years(id)
    # class_teacher_id FK → teachers(id) (nullable)
    # UNIQUE(school_id, name, section, academic_year_id)
    # CHECK(capacity > 0 AND capacity <= 100)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="classes")
    academic_year = relationship("AcademicYear", back_populates="classes")
    class_teacher = relationship("Teacher", back_populates="class_teacher_of")
    students = relationship("Student", back_populates="class_")
    class_enrollments = relationship("ClassEnrollment", back_populates="class_")
    teacher_class_subjects = relationship("TeacherClassSubject", back_populates="class_")
    timetable_entries = relationship("TimetableEntry", back_populates="class_")
    attendance_records = relationship("Attendance", back_populates="class_")
    homeworks = relationship("Homework", back_populates="class_")
    tests = relationship("Test", back_populates="class_")

    def __repr__(self) -> str:
        section_str = f" {self.section}" if self.section else ""
        return f"<Class {self.name}{section_str}>"
