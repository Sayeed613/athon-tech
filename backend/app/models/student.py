"""Student model — student-specific profile extending the users table.

1:1 relationship with User via user_id. class_id is a denormalized
pointer to the student's current class for fast queries; the canonical
enrollment history is in the class_enrollments table.

admission_number is unique per school; roll_number is unique per class.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin
from app.models.enums import Gender


class Student(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "students"

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
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False,
    )
    admission_number: Mapped[str] = mapped_column(
        String(30), nullable=False,
    )
    roll_number: Mapped[str | None] = mapped_column(
        String(10), nullable=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date, nullable=True,
    )
    gender: Mapped[Gender | None] = mapped_column(
        SAEnum(
            Gender,
            name="gender",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=True,
    )
    enrollment_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=func.current_date(),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )

    # ── Foreign Key Constraints (defined in tables.sql section 16.12) ──
    # user_id FK → users(id), UNIQUE
    # school_id FK → schools(id)
    # class_id FK → classes(id)

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="student")
    school = relationship("School", back_populates="students")
    class_ = relationship("Class", back_populates="students")
    class_enrollments = relationship("ClassEnrollment", back_populates="student")
    attendance_records = relationship("Attendance", back_populates="student")
    homework_submissions = relationship("HomeworkSubmission", back_populates="student")
    test_attempts = relationship("TestAttempt", back_populates="student")
    student_parents = relationship("StudentParent", back_populates="student")

    def __repr__(self) -> str:
        return f"<Student {self.admission_number}>"
