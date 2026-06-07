"""HomeworkSubmission model — student homework submissions.

One submission per student per homework (enforced by UNIQUE constraint).
Supports grading workflow: pending → submitted → graded.
"""

import uuid
from datetime import datetime

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import AttemptStatus


class HomeworkSubmission(TimestampMixin, Base):
    __tablename__ = "homework_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    homework_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("homeworks.id"), nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    status: Mapped[AttemptStatus] = mapped_column(
        SAEnum(
            AttemptStatus,
            name="attempt_status",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=AttemptStatus.PENDING.value,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    total_score: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True,
    )
    is_graded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    graded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    teacher_remarks: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )

    # ── Foreign Key Constraints (tables.sql section 16.19) ──
    # homework_id FK → homeworks(id)
    # student_id FK → students(id)
    # school_id FK → schools(id)
    # graded_by FK → users(id)

    # ── Relationships ───────────────────────────────────────────
    homework = relationship("Homework", back_populates="submissions")
    student = relationship("Student", back_populates="homework_submissions")
    school = relationship("School", back_populates="homework_submissions")
    answers = relationship(
        "HomeworkAnswer", back_populates="submission",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<HomeworkSubmission {self.status}>"
