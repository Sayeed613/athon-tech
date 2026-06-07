"""School Settings API endpoints — manage school profile.

Endpoints:
    - GET   /schools/{school_id}  — Get school profile
    - PATCH /schools/{school_id}  — Update school settings
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.core.database import get_db
from app.domain.schools.school_service import SchoolService
from app.models.user import User
from app.repository.schools import SchoolRepository
from pydantic import BaseModel, Field

logger = logging.getLogger("athon")

router = APIRouter(tags=["schools"])


class UpdateSchoolRequest(BaseModel):
    """Request body for updating school settings. All fields optional."""

    name: str | None = Field(None, max_length=200, description="School name")
    address: str | None = Field(None, description="School address")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    email: str | None = Field(None, max_length=200, description="Email address")
    logo_url: str | None = Field(None, max_length=500, description="Logo URL")
    settings: dict | None = Field(None, description="School settings (JSON)")


class SchoolResponse(BaseModel):
    """Standard school profile response."""

    id: str = Field(..., description="School UUID")
    name: str = Field(..., description="School name")
    code: str = Field(..., description="Unique school code")
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    domain: str | None = None
    logo_url: str | None = None
    settings: dict = Field(default_factory=dict, description="School settings")
    is_active: bool = Field(True, description="Active status")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


def _build_response(school) -> SchoolResponse:
    return SchoolResponse(
        id=str(school.id),
        name=school.name,
        code=school.code,
        address=school.address,
        phone=school.phone,
        email=school.email,
        domain=school.domain,
        logo_url=school.logo_url,
        settings=school.settings or {},
        is_active=school.is_active,
        created_at=school.created_at.isoformat() if school.created_at else "",
        updated_at=school.updated_at.isoformat() if school.updated_at else "",
    )


@router.get(
    "/schools/{school_id}",
    response_model=SchoolResponse,
)
async def get_school(
    school_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get school profile. School admin or super admin only."""
    service = SchoolService(SchoolRepository(db))

    school = await service.get_school(school_id)
    if school is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )

    return _build_response(school)


@router.patch(
    "/schools/{school_id}",
    response_model=SchoolResponse,
)
async def update_school(
    school_id: str,
    body: UpdateSchoolRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update school profile and settings. School admin or super admin only."""
    # Verify admin belongs to this school
    if str(current_user.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own school",
        )

    service = SchoolService(SchoolRepository(db))

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    school = await service.update_school(school_id, **updates)
    if school is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found",
        )

    return _build_response(school)
