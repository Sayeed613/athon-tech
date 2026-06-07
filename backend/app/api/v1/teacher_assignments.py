"""Teacher Assignment API endpoints — manage teacher ↔ class ↔ subject mappings.

Endpoints:
    - POST   /teacher-assignments              — Create assignment
    - GET    /teacher-assignments              — List assignments (with filters)
    - DELETE /teacher-assignments/{assignment_id} — Soft-delete assignment
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.core.database import get_db
from app.models.user import User
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository
from pydantic import BaseModel, Field

logger = logging.getLogger("athon")

router = APIRouter(tags=["teacher-assignments"])


class CreateAssignmentRequest(BaseModel):
    """Request body for assigning a teacher to a class/subject."""

    teacher_id: str = Field(..., description="UUID of the teacher")
    class_id: str = Field(..., description="UUID of the class")
    subject_id: str = Field(..., description="UUID of the subject")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    is_class_teacher: bool = Field(False, description="Whether this also makes them class teacher")


class AssignmentResponse(BaseModel):
    """Standard assignment response."""

    id: str = Field(..., description="Assignment UUID")
    teacher_id: str = Field(..., description="Teacher UUID")
    class_id: str = Field(..., description="Class UUID")
    subject_id: str = Field(..., description="Subject UUID")
    academic_term_id: str = Field(..., description="Academic term UUID")
    is_class_teacher: bool = Field(False)


def _build_response(a) -> AssignmentResponse:
    return AssignmentResponse(
        id=str(a.id),
        teacher_id=str(a.teacher_id),
        class_id=str(a.class_id),
        subject_id=str(a.subject_id),
        academic_term_id=str(a.academic_term_id),
        is_class_teacher=getattr(a, "is_class_teacher", False),
    )


@router.post(
    "/teacher-assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    body: CreateAssignmentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a teacher to teach a subject in a class for a given term.

    School admin only. The combination (teacher_id, class_id, subject_id,
    academic_term_id) must be unique.
    """
    repo = TeacherClassSubjectRepository(db)
    school_id = str(current_user.school_id)

    assignment = await repo.create(
        teacher_id=body.teacher_id,
        class_id=body.class_id,
        subject_id=body.subject_id,
        academic_term_id=body.academic_term_id,
        school_id=school_id,
        is_class_teacher=body.is_class_teacher,
    )
    return _build_response(assignment)


@router.get(
    "/teacher-assignments",
    response_model=list[AssignmentResponse],
)
async def list_assignments(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
    teacher_id: str | None = Query(None, description="Filter by teacher"),
    class_id: str | None = Query(None, description="Filter by class"),
    academic_term_id: str | None = Query(None, description="Filter by term"),
):
    """List teacher-class-subject assignments with optional filters.

    Accessible by school admins and principals.
    """
    repo = TeacherClassSubjectRepository(db)
    school_id = str(current_user.school_id)

    assignments = await repo.get_multi(school_id=school_id)

    # Apply in-memory filters
    if teacher_id:
        assignments = [a for a in assignments if str(a.teacher_id) == teacher_id]
    if class_id:
        assignments = [a for a in assignments if str(a.class_id) == class_id]
    if academic_term_id:
        assignments = [a for a in assignments if str(a.academic_term_id) == academic_term_id]

    return [_build_response(a) for a in assignments]


@router.delete(
    "/teacher-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_assignment(
    assignment_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a teacher-class-subject assignment. School admin only."""
    repo = TeacherClassSubjectRepository(db)
    school_id = str(current_user.school_id)

    assignment = await repo.get(assignment_id)
    if assignment is None or str(assignment.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    await repo.soft_delete(assignment_id)
