"""Class CRUD API endpoints — manage class groups.

Endpoints:
    - POST   /classes               — Create a new class
    - GET    /classes               — List classes (optionally by academic year)
    - GET    /classes/{class_id}    — Get class detail with student count
    - PATCH  /classes/{class_id}    — Update class fields
    - DELETE /classes/{class_id}    — Soft-delete class

All management endpoints require school_admin or super_admin.
List/Get also accessible by principals and teachers.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import require_role
from app.api.schemas.classes import (
    ClassListResponse,
    ClassResponse,
    CreateClassRequest,
    UpdateClassRequest,
)
from app.core.database import get_db
from app.domain.academic.class_service import ClassService
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.repository.class_repo import ClassRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["classes"])


def _build_class_response(cls, student_count: int = 0) -> ClassResponse:
    """Build a ClassResponse from a Class ORM instance."""
    year = getattr(cls, "academic_year", None)
    ct = getattr(cls, "class_teacher", None)
    ct_user = ct.user if ct and hasattr(ct, "user") else None

    return ClassResponse(
        id=str(cls.id),
        name=cls.name,
        section=cls.section,
        academic_year_id=str(cls.academic_year_id),
        academic_year_name=year.name if year else "",
        class_teacher_id=str(cls.class_teacher_id) if cls.class_teacher_id else None,
        class_teacher_name=(
            f"{ct_user.first_name} {ct_user.last_name}"
            if ct_user else None
        ),
        room_number=cls.room_number,
        capacity=cls.capacity,
        student_count=student_count,
        created_at=cls.created_at.isoformat() if cls.created_at else "",
        updated_at=cls.updated_at.isoformat() if cls.updated_at else "",
    )


@router.post(
    "/classes",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_class(
    body: CreateClassRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new class.

    School admin only. The combination of name + section + academic_year
    must be unique per school.
    """
    service = ClassService(ClassRepository(db))
    school_id = str(current_user.school_id)

    try:
        cls = await service.create_class(
            school_id=school_id,
            name=body.name,
            section=body.section,
            academic_year_id=body.academic_year_id,
            class_teacher_id=body.class_teacher_id,
            room_number=body.room_number,
            capacity=body.capacity,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_class_response(cls)


@router.get(
    "/classes",
    response_model=ClassListResponse,
)
async def list_classes(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
    academic_year_id: str | None = Query(None, description="Filter by academic year"),
):
    """List classes for the school, optionally filtered by academic year."""
    school_id = str(current_user.school_id)
    service = ClassService(ClassRepository(db))

    classes = await service.list_classes(
        school_id=school_id,
        academic_year_id=academic_year_id,
    )

    # Get student counts for each class
    responses = []
    for cls in classes:
        result = await db.execute(
            select(sa_func.count()).select_from(
                select(Student).where(
                    Student.class_id == cls.id,
                    Student.is_active.is_(True),
                    Student.deleted_at.is_(None),
                ).subquery()
            )
        )
        count = result.scalar_one()
        responses.append(_build_class_response(cls, student_count=count))

    return ClassListResponse(classes=responses, total=len(responses))


@router.get(
    "/classes/{class_id}",
    response_model=ClassResponse,
)
async def get_class(
    class_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal", "teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single class with student count."""
    school_id = str(current_user.school_id)
    service = ClassService(ClassRepository(db))

    cls = await service.get_class(class_id, school_id)
    if cls is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    result = await db.execute(
        select(sa_func.count()).select_from(
            select(Student).where(
                Student.class_id == cls.id,
                Student.is_active.is_(True),
                Student.deleted_at.is_(None),
            ).subquery()
        )
    )
    student_count = result.scalar_one()

    return _build_class_response(cls, student_count=student_count)


@router.patch(
    "/classes/{class_id}",
    response_model=ClassResponse,
)
async def update_class(
    class_id: str,
    body: UpdateClassRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a class. School admin only."""
    school_id = str(current_user.school_id)
    service = ClassService(ClassRepository(db))

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    cls = await service.update_class(class_id, school_id, **updates)

    if cls is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    return _build_class_response(cls)


@router.delete(
    "/classes/{class_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_class(
    class_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a class. School admin only."""
    school_id = str(current_user.school_id)
    service = ClassService(ClassRepository(db))

    deleted = await service.delete_class(class_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )
