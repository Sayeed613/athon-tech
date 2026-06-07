"""Timetable API endpoints — schedule views for teachers, students, and admins.

All endpoints require authentication. Role-based access control ensures:
    - Teachers see only their own schedule
    - Students see only their own class timetable
    - Principals and school admins see all schedules

All data access is delegated to ``TimetableService`` which handles
N+1 prevention via ``selectinload()`` on all related entities.
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.timetable import (
    ClassInfo,
    PeriodInfo,
    SubjectInfo,
    TeacherInfo,
    TimetableEntryResponse,
    TimetableResponse,
)
from app.core.database import get_db
from app.domain.academic.academic_calendar_service import AcademicTermService
from app.domain.academic.timetable_service import TimetableService
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.timetable_entry import TimetableEntry
from app.models.user import User
from app.repository.academic_term import AcademicTermRepository
from app.repository.timetable_repo import TimetableRepository
from pydantic import BaseModel, Field

# ── Pydantic Schemas (inline for timetable CRUD) ──────────────


class CreateTimetableEntryRequest(BaseModel):
    """Request body for creating a new timetable entry."""

    class_id: str = Field(..., description="UUID of the class")
    subject_id: str = Field(..., description="UUID of the subject")
    teacher_id: str = Field(..., description="UUID of the teacher")
    period_id: str = Field(..., description="UUID of the period")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    day_of_week: int = Field(..., ge=1, le=6, description="Day of week (1=Mon .. 6=Sat)")
    room_number: str | None = Field(None, max_length=20, description="Room number")
    is_active: bool = Field(True, description="Whether this entry is active")


class UpdateTimetableEntryRequest(BaseModel):
    """Request body for updating a timetable entry."""

    class_id: str | None = Field(None, description="Updated class UUID")
    subject_id: str | None = Field(None, description="Updated subject UUID")
    teacher_id: str | None = Field(None, description="Updated teacher UUID")
    period_id: str | None = Field(None, description="Updated period UUID")
    day_of_week: int | None = Field(None, ge=1, le=6, description="Updated day")
    room_number: str | None = Field(None, max_length=20, description="Updated room")
    is_active: bool | None = Field(None, description="Active flag")


logger = logging.getLogger("athon")

router = APIRouter(tags=["timetable"])

# ── CRUD Endpoints ──────────────────────────────────────────────


@router.post(
    "/timetable/entries",
    response_model=TimetableEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_timetable_entry(
    body: CreateTimetableEntryRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new timetable entry with conflict validation.

    School admin only. Automatically checks for teacher and class
    double-booking before creating the entry.
    """
    school_id = str(current_user.school_id)
    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)

    conflicts = await timetable_service.validate_no_conflicts(
        teacher_id=body.teacher_id,
        class_id=body.class_id,
        day_of_week=body.day_of_week,
        period_id=body.period_id,
        academic_term_id=body.academic_term_id,
    )
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Schedule conflict detected", "conflicts": conflicts},
        )

    entry = await timetable_repo.create(
        class_id=body.class_id,
        subject_id=body.subject_id,
        teacher_id=body.teacher_id,
        period_id=body.period_id,
        academic_term_id=body.academic_term_id,
        school_id=school_id,
        day_of_week=body.day_of_week,
        room_number=body.room_number,
        is_active=body.is_active,
    )

    entry = await timetable_repo.get(str(entry.id))
    return _build_entry_response(entry)


@router.patch(
    "/timetable/entries/{entry_id}",
    response_model=TimetableEntryResponse,
)
async def update_timetable_entry(
    entry_id: str,
    body: UpdateTimetableEntryRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a timetable entry with conflict validation.

    School admin only. Re-runs conflict validation excluding the
    entry being updated.
    """
    school_id = str(current_user.school_id)
    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)

    existing = await timetable_repo.get(entry_id)
    if existing is None or str(existing.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found",
        )

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}

    if any(k in updates for k in ("teacher_id", "class_id", "day_of_week", "period_id", "academic_term_id")):
        conflicts = await timetable_service.validate_no_conflicts(
            teacher_id=updates.get("teacher_id", str(existing.teacher_id)),
            class_id=updates.get("class_id", str(existing.class_id)),
            day_of_week=updates.get("day_of_week", existing.day_of_week),
            period_id=updates.get("period_id", str(existing.period_id)),
            academic_term_id=updates.get("academic_term_id", str(existing.academic_term_id)),
            exclude_entry_id=entry_id,
        )
        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": "Schedule conflict detected", "conflicts": conflicts},
            )

    await timetable_repo.update(entry_id, **updates)
    updated = await timetable_repo.get(entry_id)
    return _build_entry_response(updated)


@router.delete(
    "/timetable/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_timetable_entry(
    entry_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a timetable entry. School admin only."""
    school_id = str(current_user.school_id)
    timetable_repo = TimetableRepository(db)

    entry = await timetable_repo.get(entry_id)
    if entry is None or str(entry.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found",
        )

    await timetable_repo.soft_delete(entry_id)


# ── Helper Functions ────────────────────────────────────────────


def _build_entry_response(entry: TimetableEntry) -> TimetableEntryResponse:
    """Convert a TimetableEntry ORM instance to a response schema.

    All related entities are expected to be pre-loaded by the
    repository layer to avoid N+1 queries.
    """
    return TimetableEntryResponse(
        id=str(entry.id),
        day_of_week=entry.day_of_week,
        room_number=entry.room_number,
        is_active=entry.is_active,
        period=PeriodInfo(
            id=str(entry.period.id),
            name=entry.period.name,
            period_number=entry.period.period_number,
            start_time=entry.period.start_time,
            end_time=entry.period.end_time,
            is_break=entry.period.is_break,
        ),
        subject=SubjectInfo(
            id=str(entry.subject.id),
            name=entry.subject.name,
            code=entry.subject.code,
            is_core=entry.subject.is_core,
        ),
        teacher=TeacherInfo(
            id=str(entry.teacher.id),
            name=f"{entry.teacher.user.first_name} {entry.teacher.user.last_name}"
            if hasattr(entry.teacher, "user") and entry.teacher.user
            else entry.teacher.employee_code,
            employee_code=entry.teacher.employee_code,
        ),
        class_=ClassInfo(
            id=str(entry.class_.id),
            name=entry.class_.name,
            section=entry.class_.section,
        ),
    )


def _today_day_of_week() -> int:
    """Return the current day of the week (1=Monday … 6=Saturday).

    Python's ``date.weekday()`` returns 0=Monday … 6=Sunday.
    We map 0→1, 1→2, … 5→6, and return 1 (Monday) for Sunday (6).
    """
    py_day = date.today().weekday()
    if py_day == 6:  # Sunday → Monday for school schedules
        return 1
    return py_day + 1


async def _get_current_term_id(
    db: AsyncSession, school_id: str
) -> str:
    """Resolve the current academic term ID for a school.

    Uses ``AcademicYearService`` and ``AcademicTermService`` to resolve
    the current year, then the current term within that year. Falls back
    to the most recently created year and term if none is flagged current.
    """
    from app.domain.academic.academic_calendar_service import (
        AcademicYearService,
        AcademicTermService,
    )
    from app.repository.academic_term import AcademicTermRepository
    from app.repository.academic_year import AcademicYearRepository

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
        # Fallback: find the first non-deleted term for this year
        from sqlalchemy import desc

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


async def _get_teacher_id_for_user(db: AsyncSession, user_id: str) -> str:
    """Resolve the Teacher record ID for a given user ID."""
    result = await db.execute(
        select(Teacher).where(Teacher.user_id == user_id)
    )
    teacher = result.scalar_one_or_none()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found for current user",
        )
    return str(teacher.id)


async def _get_student_class_id(db: AsyncSession, user_id: str) -> str:
    """Resolve the Class ID for a given student user."""
    result = await db.execute(
        select(Student).where(Student.user_id == user_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for current user",
        )
    return str(student.class_id)


# ── Endpoints ───────────────────────────────────────────────────


@router.get("/timetable/teacher/me", response_model=TimetableResponse)
async def get_my_teacher_schedule(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
    term_id: str | None = Query(None, description="Override current academic term ID"),
):
    """Return today's schedule for the authenticated teacher.

    Teachers see only their own schedule. Principals and admins
    see today's schedule for the teacher associated with their
    user profile. Results are ordered by period number.
    """
    teacher_id = await _get_teacher_id_for_user(db, str(current_user.id))
    school_id = str(current_user.school_id)
    academic_term_id = term_id or await _get_current_term_id(db, school_id)
    day_of_week = _today_day_of_week()

    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)
    entries = await timetable_service.get_teacher_schedule(
        teacher_id=teacher_id,
        academic_term_id=academic_term_id,
    )

    # Filter to today only
    today_entries = [e for e in entries if e.day_of_week == day_of_week]

    return TimetableResponse(
        entries=[_build_entry_response(e) for e in today_entries]
    )


@router.get("/timetable/class/{class_id}", response_model=TimetableResponse)
async def get_class_timetable(
    class_id: str,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    term_id: str | None = Query(None, description="Override current academic term ID"),
):
    """Return the full weekly timetable for a class.

    Accessible by teachers, principals, and school admins.
    """
    school_id = str(current_user.school_id)
    academic_term_id = term_id or await _get_current_term_id(db, school_id)

    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)
    entries = await timetable_service.get_class_schedule(
        class_id=class_id,
        academic_term_id=academic_term_id,
    )

    return TimetableResponse(
        entries=[_build_entry_response(e) for e in entries]
    )


@router.get("/timetable/teacher/{teacher_id}", response_model=TimetableResponse)
async def get_teacher_timetable(
    teacher_id: str,
    current_user: User = Depends(require_role("principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    term_id: str | None = Query(None, description="Override current academic term ID"),
):
    """Return the weekly schedule for a specific teacher.

    Restricted to principals and school admins. Teachers cannot
    view other teachers' schedules.
    """
    school_id = str(current_user.school_id)
    academic_term_id = term_id or await _get_current_term_id(db, school_id)

    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)
    entries = await timetable_service.get_teacher_schedule(
        teacher_id=teacher_id,
        academic_term_id=academic_term_id,
    )

    return TimetableResponse(
        entries=[_build_entry_response(e) for e in entries]
    )


@router.get("/timetable/today", response_model=TimetableResponse)
async def get_today_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    term_id: str | None = Query(None, description="Override current academic term ID"),
):
    """Return today's schedule for the authenticated user.

    Role-aware behaviour:
        - **Teacher**: personal today schedule via ``TimetableService``
        - **Student**: class today schedule via ``TimetableService``
        - **Principal / Admin**: all today entries school-wide via ``TimetableService``
    """
    school_id = str(current_user.school_id)
    academic_term_id = term_id or await _get_current_term_id(db, school_id)
    day_of_week = _today_day_of_week()
    user_id = str(current_user.id)
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    timetable_repo = TimetableRepository(db)
    timetable_service = TimetableService(timetable_repo)

    if role_str in ("student",):
        class_id = await _get_student_class_id(db, user_id)
        entries = await timetable_service.get_class_schedule(
            class_id=class_id,
            academic_term_id=academic_term_id,
        )
        # Filter to today only
        entries = [e for e in entries if e.day_of_week == day_of_week]
    elif role_str in ("teacher",):
        teacher_id = await _get_teacher_id_for_user(db, user_id)
        entries = await timetable_service.get_teacher_schedule(
            teacher_id=teacher_id,
            academic_term_id=academic_term_id,
        )
        # Filter to today only
        entries = [e for e in entries if e.day_of_week == day_of_week]
    else:
        # Principal / School Admin → all today entries school-wide
        entries = await timetable_service.get_today_schedule(
            school_id=school_id,
            day_of_week=day_of_week,
            academic_term_id=academic_term_id,
        )

    return TimetableResponse(
        entries=[_build_entry_response(e) for e in entries]
    )
