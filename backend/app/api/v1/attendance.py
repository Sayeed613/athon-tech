"""Attendance API endpoints — mark and view daily attendance records.

All endpoints require authentication. Role-based access control ensures:
    - Teachers can mark attendance only for classes they teach
    - Students can view only their own attendance
    - Principals and school admins can view all attendance

All data access is delegated to ``AttendanceService``.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.attendance import (
    AttendanceListResponse,
    AttendanceResponse,
    BatchMarkAttendanceRequest,
    MarkAttendanceRequest,
    MarkerInfo,
    StudentInfo,
)
from app.core.database import get_db
from app.domain.attendance.attendance_service import AttendanceService
from app.domain.academic.academic_calendar_service import (
    AcademicTermService,
    AcademicYearService,
)
from app.models.attendance import Attendance
from app.models.parent import Parent
from app.models.school import School
from app.models.student import Student
from app.models.student_parent import StudentParent
from app.models.teacher import Teacher
from app.models.user import User
from app.repository.academic_term import AcademicTermRepository
from app.repository.academic_year import AcademicYearRepository
from app.repository.attendance_repo import AttendanceRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["attendance"])


# ── Helper Functions ────────────────────────────────────────────


async def _get_current_term_id(
    db: AsyncSession, school_id: str
) -> str:
    """Resolve the current academic term ID for a school.

    Uses ``AcademicYearService`` and ``AcademicTermService`` to resolve
    the current year, then the current term within that year. Falls back
    to the most recently created year and term if none is flagged current.
    """
    from sqlalchemy import desc

    year_repo = AcademicYearRepository(db)
    term_repo = AcademicTermRepository(db)
    year_service = AcademicYearService(year_repo)
    term_service = AcademicTermService(term_repo)

    # 1. Get current year (or most recent active year)
    year = await year_service.get_current_year(school_id)
    if year is None:
        year = await year_service.get_active_year(school_id)

    if year is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No academic year found for this school",
        )

    # 2. Get current term within that year
    term = await term_service.get_current_term(str(year.id))
    if term is None:
        terms = await term_repo.get_multi(
            school_id=school_id,
            limit=1,
            order_by=desc(term_repo.model.created_at),
        )
        term = terms[0] if terms else None

    if term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No academic term found for this school",
        )

    return str(term.id)


def _build_attendance_response(record: Attendance) -> AttendanceResponse:
    """Convert an Attendance ORM instance to a response schema.

    Related entities (student, marker) are expected to be pre-loaded
    by the repository layer to avoid N+1 queries.
    """
    resp = AttendanceResponse(
        id=str(record.id),
        student_id=str(record.student_id),
        class_id=str(record.class_id),
        academic_term_id=str(record.academic_term_id),
        date=record.date,
        status=record.status.value if hasattr(record.status, "value") else str(record.status),
        marked_by=str(record.marked_by),
        remarks=record.remarks,
        created_at=record.created_at.isoformat() if record.created_at else "",
        updated_at=record.updated_at.isoformat() if record.updated_at else "",
    )

    # Attach nested student info if loaded
    if hasattr(record, "student") and record.student is not None:
        student_user = record.student.user if hasattr(record.student, "user") else None
        resp.student = StudentInfo(
            id=str(record.student.id),
            admission_number=record.student.admission_number,
            first_name=student_user.first_name if student_user else "",
            last_name=student_user.last_name if student_user else "",
        )

    # Attach nested marker info if loaded
    if hasattr(record, "marker") and record.marker is not None:
        marker_user = record.marker.user if hasattr(record.marker, "user") else None
        resp.marker = MarkerInfo(
            id=str(record.marker.id),
            employee_code=record.marker.employee_code,
            name=(
                f"{marker_user.first_name} {marker_user.last_name}"
                if marker_user
                else record.marker.employee_code
            ),
        )

    return resp


async def _get_teacher_id_for_user(
    db: AsyncSession, current_user: User,
) -> str:
    """Resolve the Teacher record ID from the current user's ID."""
    result = await db.execute(
        select(Teacher).where(Teacher.user_id == current_user.id)
    )
    teacher = result.scalar_one_or_none()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found for current user",
        )
    return str(teacher.id)


async def _get_student_id_for_user(
    db: AsyncSession, current_user: User,
) -> str:
    """Resolve the Student record ID from the current user's ID."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for current user",
        )
    return str(student.id)


# ── Attendance Service Factory ──────────────────────────────────


def _build_service(db: AsyncSession) -> AttendanceService:
    """Build an AttendanceService with its repository dependencies."""
    return AttendanceService(
        attendance_repo=AttendanceRepository(db),
        tcs_repo=TeacherClassSubjectRepository(db),
    )


async def _notify_absences(
    db: AsyncSession,
    records: list[Attendance],
    school_name: str,
    school_id: str,
) -> None:
    """For each absent student, dispatch a WhatsApp alert to their parents.

    Uses the existing Celery task ``send_absence_whatsapp`` which falls
    back to dev-mode logging when WhatsApp is not configured.
    """
    from app.workers.tasks.notification_tasks import send_absence_whatsapp

    absent_records = [r for r in records if hasattr(r, "status") and r.status == "absent"]
    if not absent_records:
        return

    date_str = records[0].date.strftime("%B %d, %Y") if records[0].date else date.today().strftime("%B %d, %Y")

    for record in absent_records:
        student_id = str(record.student_id)

        # Get student's user info for the student name
        student_result = await db.execute(
            select(Student).where(Student.id == student_id).options(
                selectinload(Student.user)
            )
        )
        student = student_result.scalar_one_or_none()
        if student is None:
            continue

        student_name = (
            f"{student.user.first_name} {student.user.last_name}"
            if student.user else str(student_id)
        )

        # Find parents who have opted in for WhatsApp
        sp_result = await db.execute(
            select(StudentParent).where(
                StudentParent.student_id == student_id,
                StudentParent.receive_whatsapp == True,
            )
        )
        student_parents = list(sp_result.scalars().all())

        for sp in student_parents:
            parent_result = await db.execute(
                select(Parent).where(Parent.id == sp.parent_id).options(
                    selectinload(Parent.user)
                )
            )
            parent = parent_result.scalar_one_or_none()
            if parent is None or parent.user is None or not parent.user.phone:
                continue

            # Dispatch Celery task (logs in dev, sends in prod)
            send_absence_whatsapp.delay(
                parent_phone=parent.user.phone,
                student_name=student_name,
                school_name=school_name,
                date_str=date_str,
            )
            logger.info(
                "Dispatched absence alert to %s for %s (absent %s)",
                parent.user.phone, student_name, date_str,
            )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/attendance/mark",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def mark_attendance(
    body: MarkAttendanceRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single attendance record for a student.

    Teachers can only mark attendance for classes they teach.
    Duplicate records (same student + same date) are rejected.
    """
    teacher_id = await _get_teacher_id_for_user(db, current_user)
    service = _build_service(db)

    try:
        record = await service.mark_attendance(
            student_id=body.student_id,
            class_id=body.class_id,
            academic_term_id=body.academic_term_id,
            school_id=str(current_user.school_id),
            attendance_date=body.date,
            status=body.status,
            marked_by=teacher_id,
            remarks=body.remarks,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return _build_attendance_response(record)


@router.post(
    "/attendance/batch",
    response_model=AttendanceListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def batch_mark_attendance(
    body: BatchMarkAttendanceRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Batch-mark attendance for multiple students in a class.

    The teacher permission check is performed **once** before processing
    all records, avoiding N+1 queries. If any record conflicts with an
    existing attendance record, a 409 error is returned immediately.
    """
    teacher_id = await _get_teacher_id_for_user(db, current_user)
    service = _build_service(db)

    try:
        records = await service.batch_mark_attendance(
            records=[
                (item.student_id, item.status, item.remarks)
                for item in body.records
            ],
            class_id=body.class_id,
            academic_term_id=body.academic_term_id,
            school_id=str(current_user.school_id),
            attendance_date=body.date,
            marked_by=teacher_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    # Fire WhatsApp alerts for absent students (Celery .delay() is non-blocking)
    school_result = await db.execute(
        select(School).where(School.id == current_user.school_id)
    )
    school = school_result.scalar_one_or_none()
    school_name = school.name if school else "School"
    await _notify_absences(db, records, school_name, str(current_user.school_id))

    return AttendanceListResponse(
        records=[_build_attendance_response(r) for r in records],
        total=len(records),
    )


@router.get(
    "/attendance/class/{class_id}",
    response_model=AttendanceListResponse,
)
async def get_class_attendance(
    class_id: str,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    date_param: date | None = Query(None, alias="date", description="Specific date to query"),
    start_date: date | None = Query(None, description="Start of date range"),
    end_date: date | None = Query(None, description="End of date range"),
):
    """Get attendance records for a class.

    Accessible by teachers, principals, and school admins.
    Optionally filter by a single date or a date range.
    """
    service = _build_service(db)

    records = await service.get_class_attendance(
        class_id=class_id,
        attendance_date=date_param,
        start_date=start_date,
        end_date=end_date,
        school_id=str(current_user.school_id),
    )

    return AttendanceListResponse(
        records=[_build_attendance_response(r) for r in records],
        total=len(records),
    )


@router.get(
    "/attendance/student/{student_id}",
    response_model=AttendanceListResponse,
)
async def get_student_attendance(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str = Query(..., description="UUID of the academic term"),
):
    """Get attendance records for a specific student.

    Role-aware behaviour:
        - **Student**: Can only view their own attendance
        - **Teacher, Principal, Admin**: Can view any student's attendance
    """
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Students can only see their own attendance
    if role_str == "student":
        own_student_id = await _get_student_id_for_user(db, current_user)
        if own_student_id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own attendance records",
            )

    service = _build_service(db)

    records = await service.get_student_attendance(
        student_id=student_id,
        academic_term_id=academic_term_id,
    )

    return AttendanceListResponse(
        records=[_build_attendance_response(r) for r in records],
        total=len(records),
    )


@router.get(
    "/attendance/today",
    response_model=AttendanceListResponse,
)
async def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str | None = Query(None, description="Override current academic term ID"),
):
    """Get today's attendance records for the authenticated user.

    Role-aware behaviour:
        - **Teacher**: Attendance records for their classes today
        - **Student**: Own attendance record for today
        - **Principal / Admin**: All attendance records school-wide for today
    """
    school_id = str(current_user.school_id)
    today = date.today()
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Resolve current term if not provided
    resolved_term_id = academic_term_id or await _get_current_term_id(db, school_id)

    service = _build_service(db)

    if role_str == "student":
        student_id = await _get_student_id_for_user(db, current_user)
        records = await service.get_student_attendance(
            student_id=student_id,
            academic_term_id=resolved_term_id,
        )
        # Filter to today only
        records = [r for r in records if r.date == today]
    elif role_str == "teacher":
        teacher_id = await _get_teacher_id_for_user(db, current_user)
        # Get class IDs for this teacher using the service
        class_ids = await service.get_teacher_class_ids(
            teacher_id=teacher_id,
            academic_term_id=resolved_term_id,
        )

        # Batched query: single round-trip instead of N+1 loop
        attendance_repo = AttendanceRepository(db)
        records = await attendance_repo.get_classes_attendance_by_date(
            class_ids=list(class_ids),
            attendance_date=today,
            school_id=school_id,
        )
    else:
        # Principal / School Admin / Super Admin → all today school-wide
        records = await service.get_today_attendance(
            school_id=school_id,
            attendance_date=today,
            academic_term_id=resolved_term_id,
        )

    return AttendanceListResponse(
        records=[_build_attendance_response(r) for r in records],
        total=len(records),
    )
