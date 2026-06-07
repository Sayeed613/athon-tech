"""Service layer for subject operations.

Provides business logic for querying and managing subjects assigned
to classes.
"""

import logging
from typing import Any

from app.models.subject import Subject
from app.repository.subject_repo import SubjectRepository
from app.repository.teacher_class_subject_repo import (
    TeacherClassSubjectRepository,
)

logger = logging.getLogger("athon")


class SubjectService:
    """Service for subject management.

    Orchestrates subject queries across repositories to resolve
    class-specific subject assignments.
    """

    def __init__(
        self,
        subject_repo: SubjectRepository,
        tcs_repo: TeacherClassSubjectRepository | None = None,
    ) -> None:
        self._subject_repo = subject_repo
        self._tcs_repo = tcs_repo

    async def create_subject(
        self,
        school_id: str,
        name: str,
        code: str,
        description: str | None = None,
        is_core: bool = True,
    ) -> Subject:
        """Create a new subject.

        Both code and name must be unique per school (DB constraint).
        """
        return await self._subject_repo.create(
            school_id=school_id,
            name=name,
            code=code,
            description=description,
            is_core=is_core,
        )

    async def list_subjects(self, school_id: str) -> list[Subject]:
        """List all subjects for a school."""
        return await self._subject_repo.get_multi(school_id=school_id)

    async def get_subject(self, subject_id: str, school_id: str) -> Subject | None:
        """Get a single subject with school isolation."""
        subject = await self._subject_repo.get(subject_id)
        if subject is None or str(subject.school_id) != school_id:
            return None
        return subject

    async def update_subject(
        self,
        subject_id: str,
        school_id: str,
        **kwargs: Any,
    ) -> Subject | None:
        """Update a subject with school isolation."""
        subject = await self._subject_repo.get(subject_id)
        if subject is None or str(subject.school_id) != school_id:
            return None
        return await self._subject_repo.update(subject_id, **kwargs)

    async def delete_subject(self, subject_id: str, school_id: str) -> bool:
        """Soft-delete a subject with school isolation."""
        subject = await self._subject_repo.get(subject_id)
        if subject is None or str(subject.school_id) != school_id:
            return False
        result = await self._subject_repo.soft_delete(subject_id)
        return result is not None

    async def get_class_subjects(
        self,
        class_id: str,
        academic_term_id: str,
    ) -> list[Subject]:
        """Return all subjects taught to a class in a given term."""
        if self._tcs_repo is None:
            return []

        assignments = await self._tcs_repo.get_by_class_and_term(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )

        seen: set[str] = set()
        subjects: list[Subject] = []
        for assignment in assignments:
            if assignment.subject is not None:
                sid = str(assignment.subject.id)
                if sid not in seen:
                    seen.add(sid)
                    subjects.append(assignment.subject)
        return subjects
