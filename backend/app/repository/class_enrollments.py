"""ClassEnrollment repository — data access for student enrollment records.

Tracks the lifecycle of student enrollments across classes and
academic years. Note: ClassEnrollment does NOT have SoftDeleteMixin.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_enrollment import ClassEnrollment
from app.repository.base import BaseRepository


class ClassEnrollmentRepository(BaseRepository[ClassEnrollment]):
    """Repository for ClassEnrollment records."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, ClassEnrollment)

    async def get_active_by_student(self, student_id: str) -> ClassEnrollment | None:
        """Get the active enrollment for a student."""
        query = select(self.model).where(
            self.model.student_id == student_id,
            self.model.status == "active",
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_student(self, student_id: str) -> list[ClassEnrollment]:
        """Get all enrollment records for a student."""
        query = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .order_by(self.model.enrolled_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_class(self, class_id: str) -> list[ClassEnrollment]:
        """Get all active enrollments for a class."""
        query = select(self.model).where(
            self.model.class_id == class_id,
            self.model.status == "active",
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())
