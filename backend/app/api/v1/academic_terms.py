"""Academic Term CRUD API endpoints — manage academic terms.

Endpoints:
    - POST   /academic-terms               — Create a new term
    - GET    /academic-terms               — List terms (optionally by year)
    - GET    /academic-terms/{term_id}     — Get term detail
    - PATCH  /academic-terms/{term_id}     — Update term
    - DELETE /academic-terms/{term_id}     — Soft-delete term

Management endpoints require school_admin or super_admin.
List/Get accessible by principals.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.academic_years import (
    AcademicTermListResponse,
    AcademicTermResponse,
    CreateAcademicTermRequest,
    UpdateAcademicTermRequest,
)
from app.core.database import get_db
from app.domain.academic.academic_calendar_service import AcademicTermService
from app.models.user import User
from app.repository.academic_term import AcademicTermRepository
from app.repository.academic_year import AcademicYearRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["academic-terms"])


def _build_term_response(t, year_name: str = "") -> AcademicTermResponse:
    return AcademicTermResponse(
        id=str(t.id),
        academic_year_id=str(t.academic_year_id),
        academic_year_name=year_name,
        name=t.name,
        start_date=t.start_date,
        end_date=t.end_date,
        is_current=t.is_current,
        created_at=t.created_at.isoformat() if t.created_at else "",
        updated_at=t.updated_at.isoformat() if t.updated_at else "",
    )


@router.post(
    "/academic-terms",
    response_model=AcademicTermResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_academic_term(
    body: CreateAcademicTermRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new academic term. School admin only."""
    term_repo = AcademicTermRepository(db)
    service = AcademicTermService(term_repo)
    school_id = str(current_user.school_id)

    # Verify the year exists
    year_repo = AcademicYearRepository(db)
    year = await year_repo.get(body.academic_year_id)
    year_name = year.name if year else ""

    term = await service.create_term(
        academic_year_id=body.academic_year_id,
        school_id=school_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    return _build_term_response(term, year_name)


@router.get(
    "/academic-terms",
    response_model=AcademicTermListResponse,
)
async def list_academic_terms(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
    academic_year_id: str | None = Query(None, description="Filter by academic year"),
):
    """List academic terms, optionally filtered by year."""
    term_repo = AcademicTermRepository(db)
    year_repo = AcademicYearRepository(db)
    service = AcademicTermService(term_repo)
    school_id = str(current_user.school_id)

    terms = await service.list_terms(
        school_id=school_id,
        academic_year_id=academic_year_id,
    )

    # Resolve year names
    responses = []
    for t in terms:
        year = await year_repo.get(t.academic_year_id)
        responses.append(
            _build_term_response(t, year.name if year else "")
        )

    return AcademicTermListResponse(academic_terms=responses, total=len(responses))


@router.get(
    "/academic-terms/{term_id}",
    response_model=AcademicTermResponse,
)
async def get_academic_term(
    term_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single academic term."""
    term_repo = AcademicTermRepository(db)
    year_repo = AcademicYearRepository(db)
    service = AcademicTermService(term_repo)
    school_id = str(current_user.school_id)

    term = await service.get_term(term_id, school_id)
    if term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic term not found",
        )

    year = await year_repo.get(term.academic_year_id)
    return _build_term_response(term, year.name if year else "")


@router.patch(
    "/academic-terms/{term_id}",
    response_model=AcademicTermResponse,
)
async def update_academic_term(
    term_id: str,
    body: UpdateAcademicTermRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an academic term. School admin only."""
    term_repo = AcademicTermRepository(db)
    year_repo = AcademicYearRepository(db)
    service = AcademicTermService(term_repo)
    school_id = str(current_user.school_id)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    term = await service.update_term(term_id, school_id, **updates)

    if term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic term not found",
        )

    year = await year_repo.get(term.academic_year_id)
    return _build_term_response(term, year.name if year else "")


@router.delete(
    "/academic-terms/{term_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_academic_term(
    term_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an academic term. School admin only."""
    term_repo = AcademicTermRepository(db)
    service = AcademicTermService(term_repo)
    school_id = str(current_user.school_id)

    deleted = await service.delete_term(term_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic term not found",
        )
