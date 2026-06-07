"""TestAnswer model — per-question answers within a test attempt.

Tracks auto and manual scores for each question. answered_at tracks
how long each question took the student. CASCADE from parent attempt.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TestAnswer(Base):
    __tablename__ = "test_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    test_attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("test_questions.id"), nullable=False,
    )
    submitted_answer: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    score_auto: Mapped[float | None] = mapped_column(
        Numeric(6, 2), nullable=True,
    )
    score_manual: Mapped[float | None] = mapped_column(
        Numeric(6, 2), nullable=True,
    )
    is_correct: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True,
    )
    remarks: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Foreign Key Constraints (tables.sql section 16.24) ──
    # test_attempt_id FK → test_attempts(id) ON DELETE CASCADE
    # question_id FK → test_questions(id)

    # ── Relationships ───────────────────────────────────────────
    attempt = relationship("TestAttempt", back_populates="answers")
    question = relationship("TestQuestion")

    def __repr__(self) -> str:
        return f"<TestAnswer for question {self.question_id}>"
