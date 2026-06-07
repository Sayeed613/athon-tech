"""TimetableEntry model — unified class and teacher schedule.

The single source of truth for who teaches what subject to which class,
in which period, on which day of the week, during a given academic term.
Both class and teacher schedules are derived by filtering on class_id or teacher_id.

day_of_week uses ISO-like numbering: 1 = Monday, 6 = Saturday.
is_active allows disabling individual entries without soft-deleting them.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class TimetableEntry(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "timetable_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    academic_term_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=False,
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False,
    )
    period_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("periods.id"), nullable=False,
    )
    day_of_week: Mapped[int] = mapped_column(
        SmallInteger, nullable=False,
    )
    room_number: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )

    # ── Foreign Key Constraints (tables.sql section 16.5) ──
    # school_id FK → schools(id)
    # academic_term_id FK → academic_terms(id)
    # class_id FK → classes(id)
    # subject_id FK → subjects(id)
    # teacher_id FK → teachers(id)
    # period_id FK → periods(id)
    # UNIQUE(academic_term_id, class_id, day_of_week, period_id)
    # UNIQUE(academic_term_id, teacher_id, day_of_week, period_id)
    # CHECK(day_of_week >= 1 AND day_of_week <= 6)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="timetable_entries")
    academic_term = relationship("AcademicTerm", back_populates="timetable_entries")
    class_ = relationship("Class", back_populates="timetable_entries")
    subject = relationship("Subject", back_populates="timetable_entries")
    teacher = relationship("Teacher", back_populates="timetable_entries")
    period = relationship("Period", back_populates="timetable_entries")

    def __repr__(self) -> str:
        return f"<TimetableEntry day={self.day_of_week} period={self.period_id}>"
