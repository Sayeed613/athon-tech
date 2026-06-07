"""Homework model — homework assignments created by teachers.

Each homework is scoped to a class, subject, teacher, and academic term.
Supports a draft/publish workflow: teachers create drafts, review, then
publish. Each edit increments the version number.
"""

import uuid
from datetime import datetime

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Homework(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "homeworks"

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
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    max_score: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False, default=100.00,
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

    # ── Foreign Key Constraints (tables.sql section 16.17) ──
    # teacher_id FK → teachers(id)
    # class_id FK → classes(id)
    # subject_id FK → subjects(id)
    # school_id FK → schools(id)
    # academic_term_id FK → academic_terms(id)

    # ── Relationships ───────────────────────────────────────────
    teacher = relationship("Teacher", back_populates="homeworks")
    class_ = relationship("Class", back_populates="homeworks")
    subject = relationship("Subject", back_populates="homeworks")
    school = relationship("School", back_populates="homeworks")
    academic_term = relationship("AcademicTerm", back_populates="homeworks")
    questions = relationship(
        "HomeworkQuestion", back_populates="homework",
        cascade="all, delete-orphan",
        order_by="HomeworkQuestion.sort_order",
    )
    submissions = relationship(
        "HomeworkSubmission", back_populates="homework",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Homework {self.title}>"
