"""HomeworkAnswer model — per-question answers within a submission.

Scores are split into auto (for MCQ/TF) and manual (for written responses).
CASCADE: removing a submission removes its answers.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class HomeworkAnswer(Base):
    __tablename__ = "homework_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    homework_submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("homework_submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("homework_questions.id"), nullable=False,
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

    # ── Foreign Key Constraints (tables.sql section 16.20) ──
    # homework_submission_id FK → homework_submissions(id) ON DELETE CASCADE
    # question_id FK → homework_questions(id)

    # ── Relationships ───────────────────────────────────────────
    submission = relationship("HomeworkSubmission", back_populates="answers")
    question = relationship("HomeworkQuestion")

    def __repr__(self) -> str:
        return f"<HomeworkAnswer for question {self.question_id}>"
