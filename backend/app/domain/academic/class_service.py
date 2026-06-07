"""Service layer for class operations.

Provides business logic for querying class information including
teacher assignments, student rosters, and CRUD operations.
"""

import logging
from typing import Any

from app.models.academic_class import Class
from app.models.student import Student
from app.repository.class_repo import ClassRepository
from app.repository.teacher_class_subject_repo import (
    TeacherClassSubjectRepository,
)

logger = logging.getLogger("athon")


class ClassService:
    """Service for class group management.

    Orchestrates class-related queries across multiple repositories
    while keeping business logic separate from data access.
    """

    def __init__(
        self,
        class_repo: ClassRepository,
        tcs_repo: TeacherClassSubjectRepository | None = None,
    ) -> None:
        self._class_repo = class_repo
        self._tcs_repo = tcs_repo

    async def create_class(
        self,
        school_id: str,
        name: str,
        academic_year_id: str,
        section: str | None = None,
        class_teacher_id: str | None = None,
        room_number: str | None = None,
        capacity: int = 30,
    ) -> Class:
        """Create a new class.

        Business rules:
            1. Combination (school_id, name, section, academic_year_id)
               must be unique (enforced by DB constraint).
            2. capacity must be 1–100.

        Args:
            school_id: School UUID (tenant scope).
            name: Class name (e.g. "Grade 10").
            academic_year_id: Academic year UUID.
            section: Optional section (e.g. "A").
            class_teacher_id: Optional form teacher UUID.
            room_number: Optional room number.
            capacity: Max students (1–100, default 30).

        Returns:
            The newly created Class record.
        """
        return await self._class_repo.create(
            school_id=school_id,
            name=name,
            section=section,
            academic_year_id=academic_year_id,
            class_teacher_id=class_teacher_id,
            room_number=room_number,
            capacity=capacity,
        )

    async def get_class(self, class_id: str, school_id: str) -> Class | None:
        """Get a single class by ID with school isolation."""
        cls = await self._class_repo.get(class_id)
        if cls is None or str(cls.school_id) != school_id:
            return None
        return cls

    async def list_classes(
        self,
        school_id: str,
        academic_year_id: str | None = None,
    ) -> list[Class]:
        """List classes for a school, optionally filtered by academic year."""
        if academic_year_id:
            result = await self._class_repo.get_multi(
                school_id=school_id,
            )
            return [c for c in result if str(c.academic_year_id) == academic_year_id]
        return await self._class_repo.get_active_classes(school_id)

    async def update_class(
        self,
        class_id: str,
        school_id: str,
        **kwargs: Any,
    ) -> Class | None:
        """Update a class with school isolation."""
        cls = await self._class_repo.get(class_id)
        if cls is None or str(cls.school_id) != school_id:
            return None
        return await self._class_repo.update(class_id, **kwargs)

    async def delete_class(self, class_id: str, school_id: str) -> bool:
        """Soft-delete a class with school isolation."""
        cls = await self._class_repo.get(class_id)
        if cls is None or str(cls.school_id) != school_id:
            return False
        result = await self._class_repo.soft_delete(class_id)
        return result is not None

    async def get_teacher_classes(self, teacher_id: str) -> list[Class]:
        """Return all classes assigned to a teacher."""
        return await self._class_repo.get_by_teacher(teacher_id)

    async def get_class_roster(self, class_id: str) -> list[Student]:
        """Return the roster of active students enrolled in a class."""
        return await self._class_repo.get_students_by_class(class_id)
