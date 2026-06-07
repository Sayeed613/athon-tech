"""Service layer for academic calendar operations.

Provides business logic for CRUD and validation of academic years
and terms. Delegates all data access to the repository layer.
"""

import logging
from datetime import date
from typing import Any

from app.models.academic_term import AcademicTerm
from app.models.academic_year import AcademicYear
from app.repository.academic_term import AcademicTermRepository
from app.repository.academic_year import AcademicYearRepository

logger = logging.getLogger("athon")


class AcademicYearService:
    """Service for academic year management."""

    def __init__(
        self,
        year_repo: AcademicYearRepository,
        term_repo: AcademicTermRepository | None = None,
    ) -> None:
        self._year_repo = year_repo
        self._term_repo = term_repo

    async def create_year(
        self,
        school_id: str,
        name: str,
        start_date: date,
        end_date: date,
        is_current: bool = False,
    ) -> AcademicYear:
        """Create a new academic year.

        Name must be unique per school (DB constraint).
        """
        return await self._year_repo.create(
            school_id=school_id,
            name=name,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
        )

    async def list_years(self, school_id: str) -> list[AcademicYear]:
        """List all academic years for a school, ordered by start_date descending."""
        from sqlalchemy import desc

        return await self._year_repo.get_multi(
            school_id=school_id,
            order_by=desc(AcademicYear.start_date),
        )

    async def get_year(self, year_id: str, school_id: str) -> AcademicYear | None:
        """Get a single academic year with school isolation."""
        year = await self._year_repo.get(year_id)
        if year is None or str(year.school_id) != school_id:
            return None
        return year

    async def update_year(
        self,
        year_id: str,
        school_id: str,
        **kwargs: Any,
    ) -> AcademicYear | None:
        """Update an academic year with school isolation."""
        year = await self._year_repo.get(year_id)
        if year is None or str(year.school_id) != school_id:
            return None
        return await self._year_repo.update(year_id, **kwargs)

    async def delete_year(self, year_id: str, school_id: str) -> bool:
        """Soft-delete an academic year with school isolation."""
        year = await self._year_repo.get(year_id)
        if year is None or str(year.school_id) != school_id:
            return False
        result = await self._year_repo.soft_delete(year_id)
        return result is not None

    async def get_current_year(self, school_id: str) -> AcademicYear | None:
        """Return the current academic year for a school."""
        return await self._year_repo.get_current_year(school_id)

    async def get_active_year(self, school_id: str) -> AcademicYear | None:
        """Return the most recently created active academic year for a school."""
        return await self._year_repo.get_active_year(school_id)


class AcademicTermService:
    """Service for academic term management and validation."""

    def __init__(self, term_repo: AcademicTermRepository) -> None:
        self._term_repo = term_repo

    async def create_term(
        self,
        academic_year_id: str,
        school_id: str,
        name: str,
        start_date: date,
        end_date: date,
        is_current: bool = False,
    ) -> AcademicTerm:
        """Create a new academic term within a year.

        Name must be unique per academic year (DB constraint).
        """
        return await self._term_repo.create(
            academic_year_id=academic_year_id,
            school_id=school_id,
            name=name,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
        )

    async def list_terms(
        self,
        school_id: str,
        academic_year_id: str | None = None,
    ) -> list[AcademicTerm]:
        """List terms for a school, optionally filtered by academic year."""
        import sqlalchemy as sa

        repo_terms = await self._term_repo.get_multi(school_id=school_id)

        if academic_year_id:
            repo_terms = [
                t for t in repo_terms
                if str(t.academic_year_id) == academic_year_id
            ]

        return list(repo_terms)

    async def get_term(self, term_id: str, school_id: str) -> AcademicTerm | None:
        """Get a single term with school isolation."""
        term = await self._term_repo.get(term_id)
        if term is None or str(term.school_id) != school_id:
            return None
        return term

    async def update_term(
        self,
        term_id: str,
        school_id: str,
        **kwargs: Any,
    ) -> AcademicTerm | None:
        """Update a term with school isolation."""
        term = await self._term_repo.get(term_id)
        if term is None or str(term.school_id) != school_id:
            return None
        return await self._term_repo.update(term_id, **kwargs)

    async def delete_term(self, term_id: str, school_id: str) -> bool:
        """Soft-delete a term with school isolation."""
        term = await self._term_repo.get(term_id)
        if term is None or str(term.school_id) != school_id:
            return False
        result = await self._term_repo.soft_delete(term_id)
        return result is not None

    async def get_current_term(self, academic_year_id: str) -> AcademicTerm | None:
        """Return the current term within an academic year."""
        return await self._term_repo.get_current_term(academic_year_id)

    async def validate_term(self, academic_year_id: str, term_id: str) -> bool:
        """Check whether a term belongs to the given academic year and is active."""
        return await self._term_repo.validate_term(academic_year_id, term_id)
