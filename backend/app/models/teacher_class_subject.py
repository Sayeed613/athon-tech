"""TeacherClassSubject model — maps teachers to classes and subjects per term.

Supports multiple subjects per teacher and multiple teachers per class
(team teaching). is_class_teacher indicates the form teacher for a class.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class TeacherClassSubject(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "teacher_class_subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
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
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    academic_term_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False,
    )
    is_class_teacher: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.15) ──
    # teacher_id FK → teachers(id)
    # class_id FK → classes(id)
    # subject_id FK → subjects(id)
    # school_id FK → schools(id)
    # academic_term_id FK → academic_terms(id)
    # UNIQUE(teacher_id, class_id, subject_id, academic_term_id)

    # ── Relationships ───────────────────────────────────────────
    teacher = relationship("Teacher", back_populates="teacher_class_subjects")
    class_ = relationship("Class", back_populates="teacher_class_subjects")
    subject = relationship("Subject", back_populates="teacher_class_subjects")
    school = relationship("School", back_populates="teacher_class_subjects")
    academic_term = relationship("AcademicTerm", back_populates="teacher_class_subjects")

    def __repr__(self) -> str:
        return f"<TeacherClassSubject teacher={self.teacher_id} class={self.class_id} subject={self.subject_id}>"
