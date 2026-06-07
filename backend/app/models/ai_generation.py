"""AiGeneration model — audit trail for AI-generated content and cost tracking.

Records all AI-generated content for auditing, cost tracking, and quality
improvement. Supports multiple entity types (homework_question, test_question,
feedback, report_summary, etc.) via entity_type + optional entity_id.

No deleted_at or updated_at — generations are immutable once created.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AiGeneration(Base):
    __tablename__ = "ai_generations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    generation_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    prompt: Mapped[str] = mapped_column(
        Text, nullable=False,
    )
    response: Mapped[str] = mapped_column(
        Text, nullable=False,
    )
    model: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )
    tokens_input: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
    )
    tokens_output: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.29) ──
    # school_id FK → schools(id)
    # user_id FK → users(id)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="ai_generations")
    user = relationship("User", back_populates="ai_generations")

    def __repr__(self) -> str:
        return f"<AiGeneration {self.entity_type} [{self.generation_type}]>"
