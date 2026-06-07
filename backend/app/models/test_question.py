"""TestQuestion model — questions within a test/exam.

Supports multiple question types via the question_type enum.
options JSONB stores MCQ choices. ON DELETE CASCADE from parent test.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import QuestionType


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False,
    )
    question_text: Mapped[str] = mapped_column(
        Text, nullable=False,
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SAEnum(
            QuestionType,
            name="question_type",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=QuestionType.MULTIPLE_CHOICE.value,
    )
    options: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
    )
    explanation: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    correct_answer: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    points: Mapped[float] = mapped_column(
        Numeric(6, 2), nullable=False, default=1.00,
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.22) ──
    # test_id FK → tests(id) ON DELETE CASCADE

    # ── Relationships ───────────────────────────────────────────
    test = relationship("Test", back_populates="questions")

    def __repr__(self) -> str:
        return f"<TestQuestion {self.question_type} (order {self.sort_order})>"
