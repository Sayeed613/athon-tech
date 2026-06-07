"""Student CRUD API endpoints — manage student profiles.

Endpoints:
    - POST   /students              — Create student + user + enrollment
    - GET    /students              — List/search students
    - GET    /students/{student_id} — Get student detail with parents and enrollments
    - PATCH  /students/{student_id} — Update student profile
    - DELETE /students/{student_id} — Soft-delete student
    - POST   /students/import       — Bulk import students

All endpoints require school_admin or super_admin role (except GET
which is also accessible by principals and teachers).
All data is school-scoped from the authenticated user's context.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.students import (
    BulkImportRequest,
    BulkImportResponse,
    CreateStudentRequest,
    StudentListResponse,
    StudentResponse,
    StudentParentInfo,
    StudentEnrollmentInfo,
    UpdateStudentRequest,
)
from app.core.database import get_db
from app.domain.identity.student_service import StudentService
from app.models.user import User
from app.repository.class_enrollments import ClassEnrollmentRepository
from app.repository.class_repo import ClassRepository
from app.repository.students import StudentRepository
from app.repository.users import UserRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["students"])


# ── Helper Functions ────────────────────────────────────────────


def _build_student_response(student) -> StudentResponse:
    """Convert a Student ORM instance to a StudentResponse schema.

    Expects the Student to have 'user' and 'class_' relations loaded.
    Details (parents, enrollments) are populated when available.
    """
    user = getattr(student, "user", None)
    class_ = getattr(student, "class_", None)

    resp = StudentResponse(
        id=str(student.id),
        user_id=str(student.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else "",
        last_name=user.last_name if user else "",
        phone=user.phone if user else None,
        admission_number=student.admission_number,
        class_id=str(student.class_id),
        class_name=class_.name if class_ else "",
        roll_number=student.roll_number,
        date_of_birth=student.date_of_birth,
        gender=student.gender.value if student.gender and hasattr(student.gender, "value") else (
            str(student.gender) if student.gender else None
        ),
        enrollment_date=student.enrollment_date,
        is_active=student.is_active if hasattr(student, "is_active") else True,
        created_at=student.created_at.isoformat() if student.created_at else "",
        updated_at=student.updated_at.isoformat() if student.updated_at else "",
    )

    # Attach parent info if loaded
    if hasattr(student, "student_parents") and student.student_parents:
        for sp in student.student_parents:
            parent = getattr(sp, "parent", None)
            parent_user = parent.user if parent and hasattr(parent, "user") else None
            resp.parents.append(
                StudentParentInfo(
                    id=str(sp.id),
                    parent_id=str(sp.parent_id),
                    parent_name=(
                        f"{parent_user.first_name} {parent_user.last_name}"
                        if parent_user else ""
                    ),
                    relationship=sp.relationship.value if hasattr(sp.relationship, "value") else str(sp.relationship),
                    is_primary_contact=sp.is_primary_contact,
                )
            )

    # Attach enrollment history if loaded
    if hasattr(student, "class_enrollments") and student.class_enrollments:
        for ce in student.class_enrollments:
            ce_class = getattr(ce, "class_", None)
            ce_year = ce_class.academic_year if ce_class and hasattr(ce_class, "academic_year") else None
            resp.enrollments.append(
                StudentEnrollmentInfo(
                    id=str(ce.id),
                    class_id=str(ce.class_id),
                    class_name=ce_class.name if ce_class else "",
                    academic_year_id=str(getattr(ce, "academic_year_id", "")),
                    academic_year_name=ce_year.name if ce_year else "",
                    status=ce.status.value if hasattr(ce.status, "value") else str(ce.status),
                    enrolled_at=str(ce.enrolled_at) if ce.enrolled_at else "",
                )
            )

    return resp


def _build_service(db: AsyncSession) -> StudentService:
    """Build a StudentService with repository dependencies."""
    return StudentService(
        student_repo=StudentRepository(db),
        user_repo=UserRepository(db),
        class_repo=ClassRepository(db),
        enrollment_repo=ClassEnrollmentRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/students",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    body: CreateStudentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new student with User account and ClassEnrollment.

    School admin only. Creates the User account in Supabase Auth,
    the Student profile, and an active ClassEnrollment record.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        student = await service.create_student(
            school_id=school_id,
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            last_name=body.last_name,
            admission_number=body.admission_number,
            class_id=body.class_id,
            phone=body.phone,
            roll_number=body.roll_number,
            date_of_birth=body.date_of_birth,
            gender=body.gender,
            enrollment_date=body.enrollment_date,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    logger.info("Student created: %s (%s)", student.id, body.email)
    return _build_student_response(student)


@router.get(
    "/students",
    response_model=StudentListResponse,
)
async def list_students(
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, description="Search by name or admission number"),
    class_id: str | None = Query(None, description="Filter by class UUID"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
):
    """List students in the school with optional filters.

    Accessible by school admins and principals.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    students, total = await service.list_students(
        school_id=school_id,
        search=search,
        class_id=class_id,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )

    return StudentListResponse(
        students=[_build_student_response(s) for s in students],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/students/{student_id}",
    response_model=StudentResponse,
)
async def get_student(
    student_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal", "teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single student's profile with parents and enrollments.

    Accessible by school admins, principals, and teachers.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    student = await service.get_student(student_id, school_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    return _build_student_response(student)


@router.patch(
    "/students/{student_id}",
    response_model=StudentResponse,
)
async def update_student(
    student_id: str,
    body: UpdateStudentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a student's profile fields.

    School admin only. Supports partial updates. Changing class_id
    will create a new ClassEnrollment record.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    # Build update dicts
    student_updates = {}
    user_updates = {}

    for field in ("admission_number", "class_id", "roll_number", "date_of_birth", "gender"):
        val = getattr(body, field, None)
        if val is not None:
            student_updates[field] = val

    if body.is_active is not None:
        student_updates["is_active"] = body.is_active

    if body.first_name is not None:
        user_updates["first_name"] = body.first_name
    if body.last_name is not None:
        user_updates["last_name"] = body.last_name
    if body.phone is not None:
        user_updates["phone"] = body.phone

    try:
        student = await service.update_student(
            student_id=student_id,
            school_id=school_id,
            student_updates=student_updates,
            user_updates=user_updates if user_updates else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    return _build_student_response(student)


@router.delete(
    "/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_student(
    student_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a student (deactivate account).

    School admin only.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    deleted = await service.delete_student(student_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )


@router.post(
    "/students/import",
    response_model=BulkImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_import_students(
    body: BulkImportRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import students from a JSON array.

    School admin only. Each student is created atomically.
    Errors are collected per-row without aborting the entire batch.
    Returns counts of imported vs failed records.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    students_data = [s.model_dump() for s in body.students]
    result = await service.bulk_import(school_id, students_data)

    logger.info(
        "Bulk import: %d imported, %d failed",
        result["imported"],
        result["failed"],
    )

    return BulkImportResponse(
        imported=result["imported"],
        failed=result["failed"],
        errors=result["errors"],
    )
