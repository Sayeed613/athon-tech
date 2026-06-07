"""Period CRUD API endpoints — manage school day time slots.

Endpoints:
    - POST   /periods               — Create a new period
    - GET    /periods               — List all periods
    - GET    /periods/{period_id}   — Get period detail
    - PATCH  /periods/{period_id}   — Update period
    - DELETE /periods/{period_id}   — Soft-delete period

Management endpoints require school_admin or super_admin.
List/Get accessible by principals.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.periods import (
    CreatePeriodRequest,
    PeriodListResponse,
    PeriodResponse,
    UpdatePeriodRequest,
)
from app.core.database import get_db
from app.models.period import Period
from app.models.user import User
from app.repository.period_repo import PeriodRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["periods"])


def _build_period_response(p: Period) -> PeriodResponse:
    return PeriodResponse(
        id=str(p.id),
        name=p.name,
        period_number=p.period_number,
        start_time=p.start_time.strftime("%H:%M") if p.start_time else "",
        end_time=p.end_time.strftime("%H:%M") if p.end_time else "",
        is_break=p.is_break if hasattr(p, "is_break") else False,
        created_at=p.created_at.isoformat() if p.created_at else "",
        updated_at=p.updated_at.isoformat() if p.updated_at else "",
    )


@router.post(
    "/periods",
    response_model=PeriodResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_period(
    body: CreatePeriodRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new time slot period. School admin only."""
    repo = PeriodRepository(db)
    school_id = str(current_user.school_id)

    period = await repo.create(
        school_id=school_id,
        name=body.name,
        period_number=body.period_number,
        start_time=body.start_time,
        end_time=body.end_time,
        is_break=body.is_break,
    )
    return _build_period_response(period)


@router.get(
    "/periods",
    response_model=PeriodListResponse,
)
async def list_periods(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """List all periods for the school."""
    repo = PeriodRepository(db)
    school_id = str(current_user.school_id)

    periods = await repo.get_multi(school_id=school_id)
    return PeriodListResponse(
        periods=[_build_period_response(p) for p in periods],
        total=len(periods),
    )


@router.get(
    "/periods/{period_id}",
    response_model=PeriodResponse,
)
async def get_period(
    period_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single period with school isolation."""
    repo = PeriodRepository(db)
    school_id = str(current_user.school_id)

    period = await repo.get(period_id)
    if period is None or str(period.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found",
        )
    return _build_period_response(period)


@router.patch(
    "/periods/{period_id}",
    response_model=PeriodResponse,
)
async def update_period(
    period_id: str,
    body: UpdatePeriodRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a period. School admin only."""
    repo = PeriodRepository(db)
    school_id = str(current_user.school_id)

    period = await repo.get(period_id)
    if period is None or str(period.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found",
        )

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    updated = await repo.update(period_id, **updates)
    return _build_period_response(updated)


@router.delete(
    "/periods/{period_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_period(
    period_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a period. School admin only."""
    repo = PeriodRepository(db)
    school_id = str(current_user.school_id)

    period = await repo.get(period_id)
    if period is None or str(period.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found",
        )

    await repo.soft_delete(period_id)
