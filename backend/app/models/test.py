"""Test model — test/exam definitions created by teachers.

Supports various test types (quiz, unit_test, midterm, final) with
configurable duration limits and scheduled date/time. Two-phase publish:
is_published → visible to students, is_results_published → scores visible.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Test(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False,
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False,
    )
    academic_term_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    test_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="unit_test",
    )
    total_marks: Mapped[float] = mapped_column(
        Numeric(8, 2), nullable=False,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    is_results_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    results_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    passing_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=40.00,
    )

    # ── Foreign Key Constraints (tables.sql section 16.21) ──
    # teacher_id FK → teachers(id)
    # class_id FK → classes(id)
    # subject_id FK → subjects(id)
    # school_id FK → schools(id)
    # academic_term_id FK → academic_terms(id)

    # ── Relationships ───────────────────────────────────────────
    teacher = relationship("Teacher", back_populates="tests")
    class_ = relationship("Class", back_populates="tests")
    subject = relationship("Subject", back_populates="tests")
    school = relationship("School", back_populates="tests")
    academic_term = relationship("AcademicTerm", back_populates="tests")
    questions = relationship(
        "TestQuestion", back_populates="test",
        cascade="all, delete-orphan",
        order_by="TestQuestion.sort_order",
    )
    attempts = relationship(
        "TestAttempt", back_populates="test",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Test {self.title}>"
