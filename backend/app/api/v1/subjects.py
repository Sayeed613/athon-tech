"""Subject CRUD API endpoints — manage academic subjects.

Endpoints:
    - POST   /subjects              — Create a new subject
    - GET    /subjects              — List subjects
    - GET    /subjects/{subject_id} — Get subject detail
    - PATCH  /subjects/{subject_id} — Update subject
    - DELETE /subjects/{subject_id} — Soft-delete subject

Management endpoints require school_admin or super_admin.
List/Get also accessible by principals.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.subjects import (
    CreateSubjectRequest,
    SubjectListResponse,
    SubjectResponse,
    UpdateSubjectRequest,
)
from app.core.database import get_db
from app.domain.academic.subject_service import SubjectService
from app.models.user import User
from app.repository.subject_repo import SubjectRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["subjects"])


def _build_subject_response(s) -> SubjectResponse:
    return SubjectResponse(
        id=str(s.id),
        name=s.name,
        code=s.code,
        description=s.description,
        is_core=s.is_core if hasattr(s, "is_core") else True,
        created_at=s.created_at.isoformat() if s.created_at else "",
        updated_at=s.updated_at.isoformat() if s.updated_at else "",
    )


@router.post(
    "/subjects",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_subject(
    body: CreateSubjectRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new subject. School admin only."""
    service = SubjectService(SubjectRepository(db))
    school_id = str(current_user.school_id)

    subject = await service.create_subject(
        school_id=school_id,
        name=body.name,
        code=body.code,
        description=body.description,
        is_core=body.is_core,
    )
    return _build_subject_response(subject)


@router.get(
    "/subjects",
    response_model=SubjectListResponse,
)
async def list_subjects(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """List all subjects for the school."""
    service = SubjectService(SubjectRepository(db))
    school_id = str(current_user.school_id)

    subjects = await service.list_subjects(school_id)
    return SubjectListResponse(
        subjects=[_build_subject_response(s) for s in subjects],
        total=len(subjects),
    )


@router.get(
    "/subjects/{subject_id}",
    response_model=SubjectResponse,
)
async def get_subject(
    subject_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single subject."""
    service = SubjectService(SubjectRepository(db))
    school_id = str(current_user.school_id)

    subject = await service.get_subject(subject_id, school_id)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return _build_subject_response(subject)


@router.patch(
    "/subjects/{subject_id}",
    response_model=SubjectResponse,
)
async def update_subject(
    subject_id: str,
    body: UpdateSubjectRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a subject. School admin only."""
    service = SubjectService(SubjectRepository(db))
    school_id = str(current_user.school_id)

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    subject = await service.update_subject(subject_id, school_id, **updates)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return _build_subject_response(subject)


@router.delete(
    "/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_subject(
    subject_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a subject. School admin only."""
    service = SubjectService(SubjectRepository(db))
    school_id = str(current_user.school_id)

    deleted = await service.delete_subject(subject_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
