"""ClassEnrollment model — student enrollment history.

Tracks student movement across classes and academic years with full
history preservation. This is the canonical source for all historical
enrollments (students.class_id is a denormalized pointer to the current class).

Status values: active, promoted, transferred, graduated, withdrawn.

Note: This model does NOT extend SoftDeleteMixin because enrollment records
are never soft-deleted — they are the canonical history.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import EnrollmentStatus


class ClassEnrollment(TimestampMixin, Base):
    __tablename__ = "class_enrollments"

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
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False,
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        SAEnum(
            EnrollmentStatus,
            name="enrollment_status",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
    )

    # ── Foreign Key Constraints (tables.sql section 16.14) ──
    # school_id FK → schools(id)
    # student_id FK → students(id)
    # class_id FK → classes(id)
    # academic_year_id FK → academic_years(id)
    # UNIQUE(student_id, academic_year_id)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="class_enrollments")
    student = relationship("Student", back_populates="class_enrollments")
    class_ = relationship("Class", back_populates="class_enrollments")
    academic_year = relationship("AcademicYear", back_populates="class_enrollments")

    def __repr__(self) -> str:
        return f"<ClassEnrollment student={self.student_id} class={self.class_id} status={self.status.value}>"
