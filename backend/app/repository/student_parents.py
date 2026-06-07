"""StudentParent repository — data access for student-parent linking.

Provides CRUD operations for the many-to-many junction table.
Note: StudentParent does NOT have SoftDeleteMixin.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student_parent import StudentParent
from app.repository.base import BaseRepository


class StudentParentRepository(BaseRepository[StudentParent]):
    """Repository for StudentParent junction records."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, StudentParent)

    async def get_by_student_and_parent(
        self, student_id: str, parent_id: str
    ) -> StudentParent | None:
        """Check if a specific parent-student link already exists."""
        query = select(self.model).where(
            self.model.student_id == student_id,
            self.model.parent_id == parent_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_student(self, student_id: str) -> list[StudentParent]:
        """Get all parent links for a student."""
        query = select(self.model).where(self.model.student_id == student_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_parent(self, parent_id: str) -> list[StudentParent]:
        """Get all student links for a parent."""
        query = select(self.model).where(self.model.parent_id == parent_id)
        result = await self.db.execute(query)
        return list(result.scalars().all())
