"""Teacher model — teacher-specific profile extending the users table.

1:1 relationship with User via user_id. employee_code is unique per
school for HR tracking. is_class_teacher is a denormalized flag;
the actual form-teacher assignment is tracked in teacher_class_subjects.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Teacher(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "teachers"

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
    specialization: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
    )
    hire_date: Mapped[date] = mapped_column(
        Date, nullable=False,
    )
    is_class_teacher: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.7) ──
    # user_id FK → users(id), UNIQUE
    # school_id FK → schools(id)

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="teacher")
    school = relationship("School", back_populates="teachers")

    # Academic assignments
    teacher_class_subjects = relationship("TeacherClassSubject", back_populates="teacher")
    timetable_entries = relationship("TimetableEntry", back_populates="teacher")
    class_teacher_of = relationship("Class", back_populates="class_teacher")
    marked_attendance = relationship("Attendance", back_populates="marker")
    homeworks = relationship("Homework", back_populates="teacher")
    tests = relationship("Test", back_populates="teacher")

    def __repr__(self) -> str:
        return f"<Teacher {self.employee_code}>"
