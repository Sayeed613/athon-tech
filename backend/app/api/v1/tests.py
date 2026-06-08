"""Test API endpoints — create, attempt, and view test/exam results.

All endpoints require authentication. Role-based access control ensures:
    - Teachers create tests only for classes they teach
    - Students see only published tests for their class
    - Students attempt once per test (cannot attempt twice)
    - Students submit before duration expires
    - Teachers view results for their tests
    - Principals/admins have read-only access

All data access is delegated to ``TestService``.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.tests import (
    AttemptListResponse,
    AttemptResponse,
    CreateTestRequest,
    TestListResponse,
    TestResponse,
    ClassInfo,
    StudentInfo,
    SubjectInfo,
    TeacherInfo,
)
from app.core.database import get_db
from app.domain.academic.academic_calendar_service import (
    AcademicTermService,
    AcademicYearService,
)
from app.domain.tests.test_service import TestService
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.test import Test as TestModel
from app.models.test_attempt import TestAttempt
from app.models.user import User
from app.repository.academic_term import AcademicTermRepository
from app.repository.academic_year import AcademicYearRepository
from app.repository.test_attempt_repo import TestAttemptRepository
from app.repository.test_repo import TestRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["tests"])


# ── Helper Functions ────────────────────────────────────────────


async def _get_current_term_id(
    db: AsyncSession, school_id: str
) -> str:
    """Resolve the current academic term ID for a school."""
    from sqlalchemy import desc

    year_repo = AcademicYearRepository(db)
    term_repo = AcademicTermRepository(db)
    year_service = AcademicYearService(year_repo)
    term_service = AcademicTermService(term_repo)

    year = await year_service.get_current_year(school_id)
    if year is None:
        year = await year_service.get_active_year(school_id)
    if year is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No academic year found for this school",
        )

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


def _build_test_response(test: TestModel) -> TestResponse:
    """Convert a Test ORM instance to a response schema."""
    resp = TestResponse(
        id=str(test.id),
        class_id=str(test.class_id),
        subject_id=str(test.subject_id),
        teacher_id=str(test.teacher_id),
        academic_term_id=str(test.academic_term_id),
        title=test.title,
        description=test.description,
        test_type=test.test_type,
        total_marks=float(test.total_marks) if test.total_marks else 0,
        duration_minutes=test.duration_minutes,
        scheduled_at=test.scheduled_at,
        passing_percentage=float(test.passing_percentage) if test.passing_percentage else 40.0,
        is_published=test.is_published,
        published_at=test.published_at,
        is_results_published=test.is_results_published,
        version=test.version,
        created_at=test.created_at.isoformat() if test.created_at else "",
        updated_at=test.updated_at.isoformat() if test.updated_at else "",
    )

    if hasattr(test, "teacher") and test.teacher is not None:
        teacher_user = test.teacher.user if hasattr(test.teacher, "user") else None
        resp.teacher = TeacherInfo(
            id=str(test.teacher.id),
            name=(
                f"{teacher_user.first_name} {teacher_user.last_name}"
                if teacher_user
                else test.teacher.employee_code
            ),
            employee_code=test.teacher.employee_code,
        )

    if hasattr(test, "class_") and test.class_ is not None:
        resp.class_ = ClassInfo(
            id=str(test.class_.id),
            name=test.class_.name,
            section=test.class_.section,
        )

    if hasattr(test, "subject") and test.subject is not None:
        resp.subject = SubjectInfo(
            id=str(test.subject.id),
            name=test.subject.name,
            code=test.subject.code,
        )

    return resp


def _build_attempt_response(attempt: TestAttempt) -> AttemptResponse:
    """Convert a TestAttempt ORM instance to a response schema."""
    resp = AttemptResponse(
        id=str(attempt.id),
        test_id=str(attempt.test_id),
        student_id=str(attempt.student_id),
        status=attempt.status.value if hasattr(attempt.status, "value") else str(attempt.status),
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        total_score_auto=float(attempt.total_score_auto) if attempt.total_score_auto else None,
        total_score_manual=float(attempt.total_score_manual) if attempt.total_score_manual else None,
        total_score=float(attempt.total_score) if attempt.total_score else None,
        is_graded=attempt.is_graded,
        graded_by=str(attempt.graded_by) if attempt.graded_by else None,
        graded_at=attempt.graded_at,
        teacher_remarks=attempt.teacher_remarks,
        created_at=attempt.created_at.isoformat() if attempt.created_at else "",
        updated_at=attempt.updated_at.isoformat() if attempt.updated_at else "",
    )

    if hasattr(attempt, "student") and attempt.student is not None:
        student_user = attempt.student.user if hasattr(attempt.student, "user") else None
        resp.student = StudentInfo(
            id=str(attempt.student.id),
            admission_number=attempt.student.admission_number,
            first_name=student_user.first_name if student_user else "",
            last_name=student_user.last_name if student_user else "",
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


async def _get_student_id_and_class(
    db: AsyncSession, current_user: User,
) -> tuple[str, str]:
    """Resolve Student record ID and class ID from the current user's ID."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for current user",
        )
    return str(student.id), str(student.class_id)


# ── Service Factory ─────────────────────────────────────────────


def _build_service(db: AsyncSession) -> TestService:
    """Build a TestService with its repository dependencies."""
    return TestService(
        test_repo=TestRepository(db),
        attempt_repo=TestAttemptRepository(db),
        tcs_repo=TeacherClassSubjectRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/tests",
    response_model=TestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test(
    body: CreateTestRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new test/exam.

    Teachers can only create tests for classes they teach.
    """
    teacher_id = await _get_teacher_id_for_user(db, current_user)
    service = _build_service(db)

    try:
        test = await service.create_test(
            teacher_id=teacher_id,
            class_id=body.class_id,
            subject_id=body.subject_id,
            academic_term_id=body.academic_term_id,
            school_id=str(current_user.school_id),
            title=body.title,
            total_marks=body.total_marks,
            duration_minutes=body.duration_minutes,
            description=body.description,
            test_type=body.test_type,
            scheduled_at=body.scheduled_at,
            passing_percentage=body.passing_percentage,
            is_published=body.is_published,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return _build_test_response(test)


@router.get(
    "/tests/class/{class_id}",
    response_model=TestListResponse,
)
async def get_class_tests(
    class_id: str,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str | None = Query(None, description="Filter by academic term"),
    include_unpublished: bool = Query(
        False, description="Include unpublished drafts (teachers/admins only)"
    ),
):
    """Get tests for a class.

    Accessible by teachers, principals, and school admins.
    By default, only published tests are returned.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    resolved_term_id = academic_term_id or await _get_current_term_id(db, school_id)

    tests = await service.get_class_tests(
        class_id=class_id,
        school_id=school_id,
        academic_term_id=resolved_term_id,
        include_unpublished=include_unpublished,
    )

    return TestListResponse(
        tests=[_build_test_response(t) for t in tests],
        total=len(tests),
    )


@router.get(
    "/tests/student/me",
    response_model=TestListResponse,
)
async def get_my_tests(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str | None = Query(None, description="Filter by academic term"),
):
    """Get published tests for the authenticated student.

    Students see only published tests for their class.
    """
    student_id, class_id = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)
    school_id = str(current_user.school_id)

    resolved_term_id = academic_term_id or await _get_current_term_id(db, school_id)

    tests = await service.get_student_tests(
        class_id=class_id,
        school_id=school_id,
        academic_term_id=resolved_term_id,
    )

    return TestListResponse(
        tests=[_build_test_response(t) for t in tests],
        total=len(tests),
    )


@router.post(
    "/tests/{test_id}/start",
    response_model=AttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_test(
    test_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Start a test attempt.

    Students can start a published test once. Creates an in-progress
    attempt record with the current timestamp. Students can only
    start tests assigned to their class.
    """
    student_id, student_class_id = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        attempt = await service.start_attempt(
            student_id=student_id,
            test_id=test_id,
            school_id=school_id,
            student_class_id=student_class_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_attempt_response(attempt)


@router.post(
    "/tests/{test_id}/submit",
    response_model=AttemptResponse,
)
async def submit_test(
    test_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Submit a test attempt.

    Submits an in-progress attempt. An attempt must have been started
    via ``POST /tests/{test_id}/start`` first.
    """
    student_id, _ = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)

    try:
        attempt = await service.submit_attempt(
            student_id=student_id,
            test_id=test_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_attempt_response(attempt)


@router.get(
    "/tests/{test_id}/results",
    response_model=AttemptListResponse,
)
async def get_test_results(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get test results.

    Role-aware behaviour:
        - **Teacher**: Sees results only for their own tests.
        - **Student**: Sees only their own attempt/result.
        - **Principal / Admin**: Sees all results.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Verify the test exists
    result = await db.execute(
        select(TestModel).where(TestModel.id == test_id)
    )
    test = result.scalar_one_or_none()
    if test is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    if role_str == "teacher":
        teacher_id = await _get_teacher_id_for_user(db, current_user)
        if str(test.teacher_id) != teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only view results for their own tests",
            )

        attempts = await service.get_test_results(
            test_id=test_id,
            school_id=school_id,
        )
    elif role_str == "student":
        student_id, _ = await _get_student_id_and_class(db, current_user)
        attempt = await service.get_student_attempt(
            student_id=student_id,
            test_id=test_id,
        )
        attempts = [attempt] if attempt else []
    else:
        # Principal / School Admin / Super Admin
        attempts = await service.get_test_results(
            test_id=test_id,
            school_id=school_id,
        )

    return AttemptListResponse(
        attempts=[_build_attempt_response(a) for a in attempts],
        total=len(attempts),
    )


# ── Phase D: Test Detail ────────────────────────────────────────


@router.get(
    "/tests/{test_id}",
    response_model=TestResponse,
)
async def get_test_detail(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single test with questions.

    Role-aware:
        - Teachers: see own tests (any status)
        - Students: see published tests for their class
        - Principals/admins: see any test
    """
    school_id = str(current_user.school_id)
    repo = TestRepository(db)

    test = await repo.get_with_questions(test_id)
    if test is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    if str(test.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if role_str == "teacher":
        teacher_id = await _get_teacher_id_for_user(db, current_user)
        if str(test.teacher_id) != teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only view their own tests",
            )
    elif role_str == "student":
        if not test.is_published:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Test is not yet published",
            )

    return _build_test_response(test)


# ── Phase D: Student Test Questions ─────────────────────────────

from pydantic import BaseModel, Field


class StudentTestQuestionResponse(BaseModel):
    """Question response for students (correct_answer hidden)."""

    id: str = Field(..., description="Question UUID")
    question_number: int = Field(..., description="Question number")
    question_type: str = Field(..., description="Question type")
    question_text: str = Field(..., description="Question text")
    options: list[str] | None = Field(None, description="MCQ options")
    max_points: float = Field(..., description="Maximum points")


@router.get(
    "/tests/{test_id}/questions",
    response_model=list[StudentTestQuestionResponse],
)
async def get_test_questions(
    test_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Get test questions for a student (correct_answer hidden).

    Students can only view questions if they have an in-progress
    attempt for this test and the test is published.
    """
    student_id, class_id = await _get_student_id_and_class(db, current_user)
    school_id = str(current_user.school_id)

    # Verify test is published and for their class
    test_repo = TestRepository(db)
    test = await test_repo.get(test_id)
    if test is None or str(test.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    if not test.is_published:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test is not yet published",
        )

    if str(test.class_id) != class_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This test is not assigned to your class",
        )

    # Check student has an in-progress attempt
    attempt_repo = TestAttemptRepository(db)
    attempt = await attempt_repo.get_by_student_and_test(
        student_id=student_id,
        test_id=test_id,
    )
    if attempt is None or str(attempt.status) != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must start the test before viewing questions. Use POST /tests/{id}/start",
        )

    # Fetch questions (without correct_answer for students) using existing method
    test_with_q = await test_repo.get_with_questions(test_id)

    questions = []
    if test_with_q and hasattr(test_with_q, "questions") and test_with_q.questions:
        for q in test_with_q.questions:
            questions.append(
                StudentTestQuestionResponse(
                    id=str(q.id),
                    question_number=q.question_number,
                    question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                    question_text=q.question_text,
                    options=q.options,
                    max_points=float(q.max_points) if q.max_points else 0,
                )
            )

    return questions
