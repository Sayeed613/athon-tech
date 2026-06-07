"""Test repository — data access for test/exam definitions.

Provides school-scoped CRUD plus specialised queries for class-level
test views with eager-loaded relationships.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.test import Test
from app.models.teacher import Teacher
from app.repository.base import BaseRepository


class TestRepository(BaseRepository[Test]):
    """Repository for Test records.

    All queries are school-scoped and respect the soft-delete filter.
    """

    _DEFAULT_OPTIONS = (
        selectinload(Test.teacher).selectinload(Teacher.user),
        selectinload(Test.class_),
        selectinload(Test.subject),
        selectinload(Test.academic_term),
    )

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, Test)

    async def get_by_class(
        self,
        class_id: str,
        school_id: str | None = None,
        academic_term_id: str | None = None,
        published_only: bool = True,
    ) -> list[Test]:
        """Fetch tests for a class.

        Args:
            class_id: UUID of the class.
            school_id: Optional school scope filter.
            academic_term_id: Optional term filter.
            published_only: If True (default), only return published tests.

        Returns:
            A list of Test records ordered by scheduled_at descending.
        """
        query = (
            self._active_query()
            .where(Test.class_id == class_id)
            .options(*self._DEFAULT_OPTIONS)
        )

        if school_id is not None:
            query = self._school_scope(query, school_id)

        if academic_term_id is not None:
            query = query.where(Test.academic_term_id == academic_term_id)

        if published_only:
            query = query.where(Test.is_published.is_(True))

        query = query.order_by(Test.scheduled_at.desc().nullslast(), Test.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_published_for_student_class(
        self,
        class_id: str,
        school_id: str,
        academic_term_id: str | None = None,
    ) -> list[Test]:
        """Fetch published tests for a student's class.

        Students can only see published tests.
        """
        return await self.get_by_class(
            class_id=class_id,
            school_id=school_id,
            academic_term_id=academic_term_id,
            published_only=True,
        )

    async def get_with_questions(
        self,
        test_id: str,
    ) -> Test | None:
        """Fetch a test with its questions eager-loaded."""
        query = (
            self._active_query()
            .where(Test.id == test_id)
            .options(
                selectinload(Test.questions),
                *self._DEFAULT_OPTIONS,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
