"""Teacher CRUD API endpoints — manage teacher profiles.

Endpoints:
    - POST   /teachers              — Create teacher + user account
    - GET    /teachers              — List/search teachers
    - GET    /teachers/{teacher_id} — Get teacher detail with assignments
    - PATCH  /teachers/{teacher_id} — Update teacher profile
    - DELETE /teachers/{teacher_id} — Soft-delete teacher

All endpoints require school_admin or super_admin role.
All data is school-scoped from the authenticated user's context.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.teachers import (
    CreateTeacherRequest,
    TeacherListResponse,
    TeacherResponse,
    TeacherAssignmentInfo,
    UpdateTeacherRequest,
)
from app.core.database import get_db
from app.domain.identity.teacher_service import TeacherService
from app.models.user import User
from app.repository.teachers import TeacherRepository
from app.repository.users import UserRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["teachers"])


# ── Helper Functions ────────────────────────────────────────────


def _build_teacher_response(teacher, assignments: list | None = None) -> TeacherResponse:
    """Convert a Teacher ORM instance to a TeacherResponse schema.

    Expects the Teacher to have its 'user' relation loaded.
    """
    user = getattr(teacher, "user", None)
    resp = TeacherResponse(
        id=str(teacher.id),
        user_id=str(teacher.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else "",
        last_name=user.last_name if user else "",
        phone=user.phone if user else None,
        employee_code=teacher.employee_code,
        qualification=teacher.qualification,
        specialization=teacher.specialization,
        hire_date=teacher.hire_date,
        is_class_teacher=teacher.is_class_teacher if hasattr(teacher, "is_class_teacher") else False,
        is_active=user.is_active if user else True,
        created_at=teacher.created_at.isoformat() if teacher.created_at else "",
        updated_at=teacher.updated_at.isoformat() if teacher.updated_at else "",
    )

    # Attach assignments if provided
    if assignments:
        resp.assignments = assignments

    return resp


def _build_assignments(teacher) -> list[TeacherAssignmentInfo]:
    """Build assignment info from Teacher's teacher_class_subjects relation."""
    assignments: list[TeacherAssignmentInfo] = []
    if not hasattr(teacher, "teacher_class_subjects"):
        return assignments
    for tcs in teacher.teacher_class_subjects:
        class_ = getattr(tcs, "class_", None)
        subject = getattr(tcs, "subject", None)
        term = getattr(tcs, "academic_term", None)
        assignments.append(
            TeacherAssignmentInfo(
                id=str(tcs.id),
                class_id=str(tcs.class_id),
                class_name=class_.name if class_ else "",
                subject_id=str(tcs.subject_id),
                subject_name=subject.name if subject else "",
                academic_term_id=str(tcs.academic_term_id),
                is_class_teacher=teacher.is_class_teacher or False,
            )
        )
    return assignments


def _build_service(db: AsyncSession) -> TeacherService:
    """Build a TeacherService with repository dependencies."""
    return TeacherService(
        teacher_repo=TeacherRepository(db),
        user_repo=UserRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/teachers",
    response_model=TeacherResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_teacher(
    body: CreateTeacherRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new teacher with a User account.

    School admin only. The teacher is created in the admin's school.
    A Supabase Auth account is created for the teacher using the
    provided email and password.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        teacher = await service.create_teacher(
            school_id=school_id,
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            last_name=body.last_name,
            employee_code=body.employee_code,
            hire_date=body.hire_date,
            phone=body.phone,
            qualification=body.qualification,
            specialization=body.specialization,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    logger.info("Teacher created: %s (%s)", teacher.id, body.email)
    return _build_teacher_response(teacher)


@router.get(
    "/teachers",
    response_model=TeacherListResponse,
)
async def list_teachers(
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, description="Search by name or employee code"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
):
    """List teachers in the school with optional search.

    School admin only. Returns paginated results.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    teachers, total = await service.list_teachers(
        school_id=school_id,
        search=search,
        skip=skip,
        limit=limit,
    )

    return TeacherListResponse(
        teachers=[_build_teacher_response(t) for t in teachers],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/teachers/{teacher_id}",
    response_model=TeacherResponse,
)
async def get_teacher(
    teacher_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single teacher's profile with assignments.

    Accessible by school admins and principals.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    teacher = await service.get_teacher(teacher_id, school_id)
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    assignments = _build_assignments(teacher)
    return _build_teacher_response(teacher, assignments=assignments)


@router.patch(
    "/teachers/{teacher_id}",
    response_model=TeacherResponse,
)
async def update_teacher(
    teacher_id: str,
    body: UpdateTeacherRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a teacher's profile fields.

    School admin only. Supports partial updates — only provided
    fields are changed.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    # Build update dicts
    teacher_updates = {}
    user_updates = {}

    for field in ("employee_code", "qualification", "specialization", "hire_date"):
        val = getattr(body, field, None)
        if val is not None:
            teacher_updates[field] = val

    # is_active maps to the User record
    if body.is_active is not None:
        user_updates["is_active"] = body.is_active

    # Name fields map to User
    if body.first_name is not None:
        user_updates["first_name"] = body.first_name
    if body.last_name is not None:
        user_updates["last_name"] = body.last_name
    if body.phone is not None:
        user_updates["phone"] = body.phone

    try:
        teacher = await service.update_teacher(
            teacher_id=teacher_id,
            school_id=school_id,
            teacher_updates=teacher_updates,
            user_updates=user_updates if user_updates else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return _build_teacher_response(teacher)


@router.delete(
    "/teachers/{teacher_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_teacher(
    teacher_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a teacher (deactivate account).

    School admin only. Sets the teacher's deleted_at timestamp.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    deleted = await service.delete_teacher(teacher_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )
