"""Report API endpoints — aggregated analytics and reporting for schools.

All endpoints require authentication. Role-based access control ensures:
    - **Principal/Admin**: Access all reports school-wide
    - **Teacher**: Access reports only for classes they teach
    - **Student**: Access only their own reports

Reports aggregate data across attendance, homework, and test domains
using SQL aggregate functions for performance.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.reports import (
    AttendanceReportResponse,
    ClassSummaryReport,
    DateRangeFilter,
    HomeworkReportResponse,
    StudentSummaryReport,
    TeacherSummaryReport,
    TestReportResponse,
)
from app.core.database import get_db
from app.domain.reports.report_service import ReportService
from app.models.user import User

logger = logging.getLogger("athon")

router = APIRouter(tags=["reports"])


# ── Helper ───────────────────────────────────────────────────────


async def _get_role_str(user: User) -> str:
    """Get the role string from a user object."""
    return user.role.value if hasattr(user.role, "value") else str(user.role)


# ── Attendance Report ────────────────────────────────────────────


@router.get(
    "/reports/attendance",
    response_model=AttendanceReportResponse,
)
async def get_attendance_report(
    class_id: str | None = Query(None, description="Filter by class UUID"),
    student_id: str | None = Query(None, description="Filter by student UUID"),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD) start"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD) end"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance report.

    **Role-based visibility**:
    - **Principal/Admin**: Full school-wide or filtered by class/student.
    - **Teacher**: Only for classes they teach.
    - **Student**: Only their own attendance.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    start = None
    end = None
    if start_date:
        from datetime import date
        start = date.fromisoformat(start_date)
    if end_date:
        from datetime import date
        end = date.fromisoformat(end_date)

    service = ReportService(db)

    # Permission enforcement
    if role_str == "student":
        own_id = await service._get_student_profile_id(user_id, school_id)
        if student_id and student_id != own_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own attendance report",
            )
        student_id = own_id

    elif role_str == "teacher":
        if class_id:
            can_view = await service.check_can_view_class_report(
                user_id, role_str, school_id, class_id,
            )
            if not can_view:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view reports for classes you teach",
                )
        else:
            # Auto-scope: resolve teacher's class IDs to prevent school-wide data leak
            teacher_class_ids = await service._get_teacher_class_ids(user_id, school_id)
            if len(teacher_class_ids) == 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not assigned to any classes and cannot view school-wide attendance data.",
                )
            elif len(teacher_class_ids) == 1:
                class_id = teacher_class_ids[0]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You teach multiple classes. Please specify which class_id to view the report for.",
                )

    result = await service.get_attendance_report(
        school_id=school_id,
        class_id=class_id,
        student_id=student_id,
        start_date=start,
        end_date=end,
    )

    return result


# ── Homework Report ──────────────────────────────────────────────


@router.get(
    "/reports/homework",
    response_model=HomeworkReportResponse,
)
async def get_homework_report(
    class_id: str | None = Query(None, description="Filter by class UUID"),
    student_id: str | None = Query(None, description="Filter by student UUID"),
    teacher_id: str | None = Query(None, description="Filter by teacher UUID"),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get homework report with completion metrics.

    **Role-based visibility**:
    - **Principal/Admin**: Full access.
    - **Teacher**: Only for their own classes.
    - **Student**: Only their own submissions.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    start = None
    end = None
    if start_date:
        from datetime import date
        start = date.fromisoformat(start_date)
    if end_date:
        from datetime import date
        end = date.fromisoformat(end_date)

    service = ReportService(db)

    if role_str == "student":
        own_id = await service._get_student_profile_id(user_id, school_id)
        if student_id and student_id != own_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own homework report",
            )
        student_id = own_id

    elif role_str == "teacher":
        if class_id:
            can_view = await service.check_can_view_class_report(
                user_id, role_str, school_id, class_id,
            )
            if not can_view:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view reports for classes you teach",
                )
        else:
            # Auto-scope: resolve teacher's own profile ID so the query
            # filters by teacher_id instead of returning school-wide data
            resolved_teacher_id = await service._get_teacher_profile_id(user_id, school_id)
            if resolved_teacher_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Teacher profile not found for this user.",
                )
            teacher_id = resolved_teacher_id

    result = await service.get_homework_report(
        school_id=school_id,
        class_id=class_id,
        student_id=student_id,
        teacher_id=teacher_id,
        start_date=start,
        end_date=end,
    )

    return result


# ── Test Report ──────────────────────────────────────────────────


@router.get(
    "/reports/tests",
    response_model=TestReportResponse,
)
async def get_test_report(
    class_id: str | None = Query(None, description="Filter by class UUID"),
    student_id: str | None = Query(None, description="Filter by student UUID"),
    teacher_id: str | None = Query(None, description="Filter by teacher UUID"),
    start_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="ISO date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get test report with score and pass-rate metrics.

    **Role-based visibility**:
    - **Principal/Admin**: Full access.
    - **Teacher**: Only for their own classes.
    - **Student**: Only their own results.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    start = None
    end = None
    if start_date:
        from datetime import date
        start = date.fromisoformat(start_date)
    if end_date:
        from datetime import date
        end = date.fromisoformat(end_date)

    service = ReportService(db)

    if role_str == "student":
        own_id = await service._get_student_profile_id(user_id, school_id)
        if student_id and student_id != own_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own test report",
            )
        student_id = own_id

    elif role_str == "teacher":
        if class_id:
            can_view = await service.check_can_view_class_report(
                user_id, role_str, school_id, class_id,
            )
            if not can_view:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view reports for classes you teach",
                )
        else:
            # Auto-scope: resolve teacher's own profile ID so the query
            # filters by teacher_id instead of returning school-wide data
            resolved_teacher_id = await service._get_teacher_profile_id(user_id, school_id)
            if resolved_teacher_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Teacher profile not found for this user.",
                )
            teacher_id = resolved_teacher_id

    result = await service.get_test_report(
        school_id=school_id,
        class_id=class_id,
        student_id=student_id,
        teacher_id=teacher_id,
        start_date=start,
        end_date=end,
    )

    return result


# ── Student Summary Report ───────────────────────────────────────


@router.get(
    "/reports/student/{student_id}",
    response_model=StudentSummaryReport,
)
async def get_student_summary(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a consolidated summary report for a specific student.

    Includes attendance, homework, and test metrics in a single response.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    service = ReportService(db)

    can_view = await service.check_can_view_student_report(
        user_id, role_str, school_id, student_id,
    )
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this student's report",
        )

    result = await service.get_student_summary(school_id, student_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    return result


# ── Class Summary Report ─────────────────────────────────────────


@router.get(
    "/reports/class/{class_id}",
    response_model=ClassSummaryReport,
)
async def get_class_summary(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a consolidated summary report for a class.

    Includes attendance, homework, and test metrics.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    service = ReportService(db)

    can_view = await service.check_can_view_class_report(
        user_id, role_str, school_id, class_id,
    )
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this class report",
        )

    result = await service.get_class_summary(school_id, class_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    return result


# ── Teacher Summary Report ───────────────────────────────────────


@router.get(
    "/reports/teacher/{teacher_id}",
    response_model=TeacherSummaryReport,
)
async def get_teacher_summary(
    teacher_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a consolidated summary report for a teacher.

    Includes homework and test metrics, assigned classes.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = await _get_role_str(current_user)

    service = ReportService(db)

    can_view = await service.check_can_view_teacher_report(
        user_id, role_str, school_id, teacher_id,
    )
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this teacher's report",
        )

    result = await service.get_teacher_summary(school_id, teacher_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return result
