"""AuditLog model — immutable audit trail for compliance and security.

Records all CREATE, UPDATE, and DELETE operations on core entities.
old_data / new_data store before/after JSONB snapshots.
No deleted_at or updated_at — audit records are immutable once written.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    action: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    old_data: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
    )
    new_data: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        INET, nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Foreign Key Constraints (tables.sql section 16.28) ──
    # school_id FK → schools(id)
    # user_id FK → users(id)

    # ── Relationships ───────────────────────────────────────────
    school = relationship("School", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.entity_type}:{self.entity_id}>"
