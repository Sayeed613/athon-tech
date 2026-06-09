"""Dashboard API endpoints — aggregated data views for each user role.

Each endpoint composes data from existing services (ReportService,
NotificationService, direct repository queries) into a single
dashboard response. No duplicated aggregation logic.

Endpoints:
    GET /dashboard/principal — Principal's school-wide overview
    GET /dashboard/teacher   — Teacher's class and task overview
    GET /dashboard/student   — Student's academic overview
    GET /dashboard/admin     — School admin's overview
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.dashboard import (
    AdminDashboardResponse,
    ParentDashboardResponse,
    PrincipalDashboardResponse,
    StudentDashboardResponse,
    TeacherDashboardResponse,
)
from app.core.database import get_db
from app.domain.dashboard.dashboard_service import DashboardService
from app.models.user import User

logger = logging.getLogger("athon")

router = APIRouter(tags=["dashboard"])


# ── Principal Dashboard ─────────────────────────────────────────


@router.get(
    "/dashboard/principal",
    response_model=PrincipalDashboardResponse,
)
async def principal_dashboard(
    current_user: User = Depends(require_role("principal", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get principal dashboard — school-wide overview.

    Requires ``principal`` or ``super_admin`` role.
    Returns student/teacher counts, attendance %, homework completion,
    test pass rate, recent announcements, and unread notifications.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = DashboardService(db)
    result = await service.get_principal_dashboard(
        school_id=school_id,
        user_id=user_id,
    )

    return result


# ── Parent Dashboard ──────────────────────────────────────────


@router.get(
    "/dashboard/parent",
    response_model=ParentDashboardResponse,
)
async def parent_dashboard(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get parent dashboard — school updates overview.

    Requires ``parent`` role.
    Returns school-wide attendance percentage, recent announcements,
    and unread notifications.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = DashboardService(db)
    result = await service.get_parent_dashboard(
        school_id=school_id,
        user_id=user_id,
    )

    return result


# ── Teacher Dashboard ────────────────────────────────────────────


@router.get(
    "/dashboard/teacher",
    response_model=TeacherDashboardResponse,
)
async def teacher_dashboard(
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Get teacher dashboard — class and task overview.

    Requires ``teacher`` role.
    Returns today's schedule, assigned classes, attendance pending,
    homework pending review, upcoming tests, and unread notifications.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = DashboardService(db)
    result = await service.get_teacher_dashboard(
        school_id=school_id,
        user_id=user_id,
    )

    return result


# ── Student Dashboard ────────────────────────────────────────────


@router.get(
    "/dashboard/student",
    response_model=StudentDashboardResponse,
)
async def student_dashboard(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Get student dashboard — academic overview.

    Requires ``student`` role.
    Returns today's timetable, homework due, upcoming tests,
    attendance %, recent announcements, and unread notifications.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = DashboardService(db)
    result = await service.get_student_dashboard(
        school_id=school_id,
        user_id=user_id,
    )

    return result


# ── Admin Dashboard ──────────────────────────────────────────────


@router.get(
    "/dashboard/admin",
    response_model=AdminDashboardResponse,
)
async def admin_dashboard(
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get school admin dashboard — school overview.

    Requires ``school_admin`` or ``super_admin`` role.
    Returns student/teacher/class counts, attendance %,
    recent announcements, and unread notifications.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = DashboardService(db)
    result = await service.get_admin_dashboard(
        school_id=school_id,
        user_id=user_id,
    )

    return result
