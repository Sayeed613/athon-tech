"""StudentParent model — many-to-many student ↔ parent junction table.

Enables a many-to-many relationship: a student can have multiple parents
(father, mother, guardian), and a parent can have multiple children.
Tracks relationship type, primary contact status, and WhatsApp opt-in.

This model intentionally omits SoftDeleteMixin because the underlying
student_parents table has no deleted_at column.

NOTE: The column named ``relationship`` shadows SQLAlchemy's ``relationship``
function, so we import it under an alias ``orm_relationship``.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as orm_relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ParentRelationship


class StudentParent(TimestampMixin, Base):
    __tablename__ = "student_parents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id"), nullable=False,
    )
    parent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parents.id"), nullable=False,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False,
    )
    relationship: Mapped[ParentRelationship] = mapped_column(
        SAEnum(
            ParentRelationship,
            name="parent_relationship",
            create_type=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    is_primary_contact: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    receive_whatsapp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )

    # ── Foreign Key Constraints (tables.sql section 16.13) ──
    # student_id FK → students(id)
    # parent_id FK → parents(id)
    # school_id FK → schools(id)
    # UNIQUE(student_id, parent_id)

    # ── Relationships ───────────────────────────────────────────
    student = orm_relationship("Student", back_populates="student_parents")
    parent = orm_relationship("Parent", back_populates="student_parents")
    school = orm_relationship("School", back_populates="student_parents")

    def __repr__(self) -> str:
        return f"<StudentParent student={self.student_id} parent={self.parent_id} [{self.relationship}]>"
