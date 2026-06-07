"""Student-parent linking API endpoint.

Provides:
    - POST /student-parents — Link an existing parent to an existing student

This is an admin-only operation for managing parent-child relationships.
The Parent Portal read-only endpoints live in parents.py.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.core.database import get_db
from app.models.enums import ParentRelationship
from app.models.parent import Parent
from app.models.student import Student
from app.models.student_parent import StudentParent
from app.models.user import User
from app.repository.student_parents import StudentParentRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["student-parents"])


# ── Request Schema ──────────────────────────────────────────────


from pydantic import BaseModel, Field


class LinkParentRequest(BaseModel):
    """Request body for linking a parent to a student."""

    student_id: str = Field(..., description="UUID of the student")
    parent_id: str = Field(..., description="UUID of the parent")
    relationship: str = Field(
        "father", description="Relationship type (father, mother, guardian, other)"
    )
    is_primary_contact: bool = Field(False, description="Whether this parent is the primary contact")
    receive_whatsapp: bool = Field(True, description="Whether this parent receives WhatsApp messages")


class LinkParentResponse(BaseModel):
    """Response for a successful parent-student link."""

    id: str = Field(..., description="StudentParent link UUID")
    student_id: str = Field(..., description="Student UUID")
    parent_id: str = Field(..., description="Parent UUID")
    relationship: str = Field(..., description="Relationship type")
    is_primary_contact: bool = Field(False, description="Primary contact flag")
    receive_whatsapp: bool = Field(True, description="WhatsApp opt-in status")


# ── Endpoints ───────────────────────────────────────────────────


@router.delete(
    "/student-parents/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_parent_from_student(
    link_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Unlink a parent from a student by deleting the StudentParent record.

    School admin only. Both parent and student must belong to the
    same school as the admin. Hard-deletes the junction record
    (no soft delete on this table).
    """
    school_id = str(current_user.school_id)

    repo = StudentParentRepository(db)
    link = await repo.get(link_id)

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent-student link not found",
        )

    if str(link.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Link does not belong to this school",
        )

    await repo.hard_delete(link_id)
    logger.info(
        "Unlinked parent %s from student %s",
        link.parent_id, link.student_id,
    )


@router.post(
    "/student-parents",
    response_model=LinkParentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def link_parent_to_student(
    body: LinkParentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Link an existing parent to an existing student.

    School admin only. Both parent and student must belong to the
    same school as the admin. The relationship type must be one of:
    father, mother, guardian, other.
    """
    school_id = str(current_user.school_id)

    # Validate relationship type
    relationship = body.relationship.lower().strip()
    valid_relationships = {e.value for e in ParentRelationship}
    if relationship not in valid_relationships:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid relationship. Must be one of: {', '.join(sorted(valid_relationships))}",
        )

    # Validate student exists and is in same school
    result = await db.execute(
        select(Student).where(Student.id == body.student_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    if str(student.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student does not belong to this school",
        )

    # Validate parent exists and is in same school
    result = await db.execute(
        select(Parent).where(Parent.id == body.parent_id)
    )
    parent = result.scalar_one_or_none()
    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found",
        )
    if str(parent.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parent does not belong to this school",
        )

    # Check existing link
    repo = StudentParentRepository(db)
    existing = await repo.get_by_student_and_parent(
        student_id=body.student_id,
        parent_id=body.parent_id,
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This parent is already linked to this student",
        )

    # Create the link
    link = await repo.create(
        student_id=body.student_id,
        parent_id=body.parent_id,
        school_id=school_id,
        relationship=relationship,
        is_primary_contact=body.is_primary_contact,
        receive_whatsapp=body.receive_whatsapp,
    )

    logger.info(
        "Linked parent %s to student %s [%s]",
        body.parent_id, body.student_id, relationship,
    )

    return LinkParentResponse(
        id=str(link.id),
        student_id=str(link.student_id),
        parent_id=str(link.parent_id),
        relationship=link.relationship.value if hasattr(link.relationship, "value") else str(link.relationship),
        is_primary_contact=link.is_primary_contact,
        receive_whatsapp=link.receive_whatsapp,
    )
