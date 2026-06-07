"""API v1 router — aggregates all version 1 endpoint routers.

Add new routers here as they are created. The main application
includes this single router under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.timetable import router as timetable_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.homeworks import router as homework_router
from app.api.v1.tests import router as test_router
from app.api.v1.notifications import router as notification_router
from app.api.v1.announcements import router as announcement_router
from app.api.v1.reports import router as report_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.parents import router as parent_router
from app.api.v1.teachers import router as teacher_router
from app.api.v1.students import router as student_router
from app.api.v1.principals import router as principal_router
from app.api.v1.student_parents import router as student_parent_router
from app.api.v1.classes import router as class_router
from app.api.v1.subjects import router as subject_router
from app.api.v1.academic_years import router as academic_year_router
from app.api.v1.academic_terms import router as academic_term_router
from app.api.v1.periods import router as period_router
from app.api.v1.teacher_assignments import router as teacher_assignment_router
from app.api.v1.schools import router as school_router

router = APIRouter()

router.include_router(health_router)
router.include_router(auth_router)
router.include_router(timetable_router)
router.include_router(attendance_router)
router.include_router(homework_router)
router.include_router(test_router)
router.include_router(notification_router)
router.include_router(announcement_router)
router.include_router(report_router)
router.include_router(dashboard_router)
router.include_router(parent_router)
router.include_router(teacher_router)
router.include_router(student_router)
router.include_router(principal_router)
router.include_router(student_parent_router)
router.include_router(class_router)
router.include_router(subject_router)
router.include_router(academic_year_router)
router.include_router(academic_term_router)
router.include_router(period_router)
router.include_router(teacher_assignment_router)
router.include_router(school_router)
