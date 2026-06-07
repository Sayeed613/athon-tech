"""Principal CRUD API endpoints — manage principal profiles.

Endpoints:
    - POST   /principals               — Create principal + user account
    - GET    /principals               — List/search principals
    - GET    /principals/{principal_id} — Get principal detail
    - PATCH  /principals/{principal_id} — Update principal profile
    - DELETE /principals/{principal_id} — Soft-delete principal

All endpoints require school_admin or super_admin role.
All data is school-scoped from the authenticated user's context.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.principals import (
    CreatePrincipalRequest,
    PrincipalListResponse,
    PrincipalResponse,
    UpdatePrincipalRequest,
)
from app.core.database import get_db
from app.domain.identity.principal_service import PrincipalService
from app.models.user import User
from app.repository.principals import PrincipalRepository
from app.repository.users import UserRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["principals"])


# ── Helper Functions ────────────────────────────────────────────


def _build_principal_response(principal) -> PrincipalResponse:
    """Convert a Principal ORM instance to a PrincipalResponse schema.

    Expects the Principal to have its 'user' relation loaded.
    """
    user = getattr(principal, "user", None)
    return PrincipalResponse(
        id=str(principal.id),
        user_id=str(principal.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else "",
        last_name=user.last_name if user else "",
        phone=user.phone if user else None,
        employee_code=principal.employee_code,
        qualification=principal.qualification,
        appointment_type=principal.appointment_type,
        tenure_start_date=principal.tenure_start_date,
        tenure_end_date=principal.tenure_end_date,
        is_active=user.is_active if user else True,
        created_at=principal.created_at.isoformat() if principal.created_at else "",
        updated_at=principal.updated_at.isoformat() if principal.updated_at else "",
    )


def _build_service(db: AsyncSession) -> PrincipalService:
    """Build a PrincipalService with repository dependencies."""
    return PrincipalService(
        principal_repo=PrincipalRepository(db),
        user_repo=UserRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/principals",
    response_model=PrincipalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_principal(
    body: CreatePrincipalRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new principal with a User account.

    School admin only. The principal is created in the admin's school.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        principal = await service.create_principal(
            school_id=school_id,
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            last_name=body.last_name,
            employee_code=body.employee_code,
            tenure_start_date=body.tenure_start_date,
            phone=body.phone,
            qualification=body.qualification,
            appointment_type=body.appointment_type,
            tenure_end_date=body.tenure_end_date,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    logger.info("Principal created: %s (%s)", principal.id, body.email)
    return _build_principal_response(principal)


@router.get(
    "/principals",
    response_model=PrincipalListResponse,
)
async def list_principals(
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, description="Search by name or employee code"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
):
    """List principals in the school with optional search.

    School admin only.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    principals, total = await service.list_principals(
        school_id=school_id,
        search=search,
        skip=skip,
        limit=limit,
    )

    return PrincipalListResponse(
        principals=[_build_principal_response(p) for p in principals],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/principals/{principal_id}",
    response_model=PrincipalResponse,
)
async def get_principal(
    principal_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single principal's profile.

    School admin only.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    principal = await service.get_principal(principal_id, school_id)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Principal not found",
        )

    return _build_principal_response(principal)


@router.patch(
    "/principals/{principal_id}",
    response_model=PrincipalResponse,
)
async def update_principal(
    principal_id: str,
    body: UpdatePrincipalRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a principal's profile fields.

    School admin only. Supports partial updates.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    # Build update dicts
    principal_updates = {}
    user_updates = {}

    for field in (
        "employee_code", "qualification", "appointment_type",
        "tenure_start_date", "tenure_end_date",
    ):
        val = getattr(body, field, None)
        if val is not None:
            principal_updates[field] = val

    if body.is_active is not None:
        user_updates["is_active"] = body.is_active

    if body.first_name is not None:
        user_updates["first_name"] = body.first_name
    if body.last_name is not None:
        user_updates["last_name"] = body.last_name
    if body.phone is not None:
        user_updates["phone"] = body.phone

    try:
        principal = await service.update_principal(
            principal_id=principal_id,
            school_id=school_id,
            principal_updates=principal_updates,
            user_updates=user_updates if user_updates else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Principal not found",
        )

    return _build_principal_response(principal)


@router.delete(
    "/principals/{principal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_principal(
    principal_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a principal (deactivate account).

    School admin only.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    deleted = await service.delete_principal(principal_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Principal not found",
        )
