"""Attendance model — daily attendance records for students.

One record per student per day. The UNIQUE(student_id, date) constraint
ensures exactly one record per student per day.

This model intentionally omits SoftDeleteMixin because the underlying
attendance table has no ``deleted_at`` column — attendance records are
immutable once created (corrections are handled via updates, not deletes).
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import AttendanceStatus


class Attendance(TimestampMixin, Base):
    """Daily attendance record for a student.

    Attributes:
        id: UUID primary key.
        school_id: Tenant scope (FK to schools).
        student_id: The student whose attendance is recorded (FK to students).
        class_id: The class the student belongs to (FK to classes).
        academic_term_id: The academic term scope (FK to academic_terms).
        date: The calendar date of the attendance record.
        status: Attendance status (present, absent, late, half_day).
        marked_by: Teacher UUID who marked this record (FK to teachers).
        remarks: Optional teacher notes about the attendance.
    """

    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False,
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False,
    )
    academic_term_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False,
    )
    date: Mapped[date] = mapped_column(
        Date, nullable=False,
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        SAEnum(
            AttendanceStatus,
            name="attendance_status",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    marked_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False,
    )
    remarks: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.16) ──
    # student_id FK → students(id)
    # class_id FK → classes(id)
    # school_id FK → schools(id)
    # marked_by FK → teachers(id)
    # academic_term_id FK → academic_terms(id)

    # ── Relationships ───────────────────────────────────────────
    student = relationship("Student", back_populates="attendance_records")
    class_ = relationship("Class", back_populates="attendance_records")
    school = relationship("School", back_populates="attendance_records")
    marker = relationship("Teacher", back_populates="marked_attendance")
    academic_term = relationship("AcademicTerm", back_populates="attendance_records")

    def __repr__(self) -> str:
        return f"<Attendance {self.student_id} on {self.date}: {self.status}>"
