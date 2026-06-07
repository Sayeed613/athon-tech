"""Period model — school day time slots.

Defines the time slots that make up a school day (e.g. "Period 1: 08:00–08:45",
"Morning Break: 09:30–09:50"). Each school defines its own period structure
independently. period_number determines chronological ordering.
is_break distinguishes instructional periods from breaks (recess, lunch).
"""

import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Period(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "periods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    period_number: Mapped[int] = mapped_column(
        Integer, nullable=False,
    )
    start_time: Mapped[time] = mapped_column(
        Time, nullable=False,
    )
    end_time: Mapped[time] = mapped_column(
        Time, nullable=False,
    )
    is_break: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.4) ──
    # school_id FK → schools(id)
    # UNIQUE(school_id, period_number)
    # CHECK(end_time > start_time)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="periods")
    timetable_entries = relationship("TimetableEntry", back_populates="period")

    def __repr__(self) -> str:
        return f"<Period {self.name} ({self.start_time}-{self.end_time})>"
