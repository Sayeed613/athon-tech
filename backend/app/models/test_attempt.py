"""TestAttempt model — student test attempts.

Tracks start and submission times for duration monitoring.
Scores are split into auto (MCQ/TF), manual (written), and total.
UNIQUE(test_id, student_id) enforces one attempt per student per test.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import AttemptStatus


class TestAttempt(TimestampMixin, Base):
    __tablename__ = "test_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tests.id"), nullable=False,
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
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    total_score_auto: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True,
    )
    total_score_manual: Mapped[float | None] = mapped_column(
        Numeric(8, 2), nullable=True,
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

    # ── Foreign Key Constraints (tables.sql section 16.23) ──
    # test_id FK → tests(id)
    # student_id FK → students(id)
    # school_id FK → schools(id)
    # graded_by FK → users(id)

    # ── Relationships ───────────────────────────────────────────
    test = relationship("Test", back_populates="attempts")
    student = relationship("Student", back_populates="test_attempts")
    school = relationship("School", back_populates="test_attempts")
    answers = relationship(
        "TestAnswer", back_populates="attempt",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TestAttempt {self.status}>"
