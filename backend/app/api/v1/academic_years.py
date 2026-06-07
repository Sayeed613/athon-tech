"""Academic Year CRUD API endpoints — manage academic calendar years.

Endpoints:
    - POST   /academic-years               — Create a new academic year
    - GET    /academic-years               — List all academic years
    - GET    /academic-years/{year_id}     — Get academic year detail
    - PATCH  /academic-years/{year_id}     — Update academic year
    - DELETE /academic-years/{year_id}     — Soft-delete academic year

Management endpoints require school_admin or super_admin.
List/Get accessible by principals.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.academic_years import (
    AcademicYearListResponse,
    AcademicYearResponse,
    CreateAcademicYearRequest,
    UpdateAcademicYearRequest,
)
from app.core.database import get_db
from app.domain.academic.academic_calendar_service import AcademicYearService
from app.models.user import User
from app.repository.academic_year import AcademicYearRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["academic-years"])


def _build_year_response(y) -> AcademicYearResponse:
    return AcademicYearResponse(
        id=str(y.id),
        name=y.name,
        start_date=y.start_date,
        end_date=y.end_date,
        is_current=y.is_current,
        created_at=y.created_at.isoformat() if y.created_at else "",
        updated_at=y.updated_at.isoformat() if y.updated_at else "",
    )


@router.post(
    "/academic-years",
    response_model=AcademicYearResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_academic_year(
    body: CreateAcademicYearRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new academic year. School admin only."""
    service = AcademicYearService(AcademicYearRepository(db))
    school_id = str(current_user.school_id)

    year = await service.create_year(
        school_id=school_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    return _build_year_response(year)


@router.get(
    "/academic-years",
    response_model=AcademicYearListResponse,
)
async def list_academic_years(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """List all academic years for the school."""
    service = AcademicYearService(AcademicYearRepository(db))
    school_id = str(current_user.school_id)

    years = await service.list_years(school_id)
    return AcademicYearListResponse(
        academic_years=[_build_year_response(y) for y in years],
        total=len(years),
    )


@router.get(
    "/academic-years/{year_id}",
    response_model=AcademicYearResponse,
)
async def get_academic_year(
    year_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single academic year."""
    service = AcademicYearService(AcademicYearRepository(db))
    school_id = str(current_user.school_id)

    year = await service.get_year(year_id, school_id)
    if year is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return _build_year_response(year)


@router.patch(
    "/academic-years/{year_id}",
    response_model=AcademicYearResponse,
)
async def update_academic_year(
    year_id: str,
    body: UpdateAcademicYearRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an academic year. School admin only."""
    service = AcademicYearService(AcademicYearRepository(db))
    school_id = str(current_user.school_id)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    year = await service.update_year(year_id, school_id, **updates)

    if year is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
    return _build_year_response(year)


@router.delete(
    "/academic-years/{year_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_academic_year(
    year_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an academic year. School admin only."""
    service = AcademicYearService(AcademicYearRepository(db))
    school_id = str(current_user.school_id)

    deleted = await service.delete_year(year_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Academic year not found",
        )
