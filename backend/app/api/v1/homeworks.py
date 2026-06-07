"""Homework API endpoints — create, view, submit, grade homework assignments.

All endpoints require authentication. Role-based access control ensures:
    - Teachers create homework only for classes they teach
    - Students see only published homework for their class
    - Students submit once per homework (before due date)
    - Teachers view submissions for their homework
    - Teachers grade submissions
    - Principals/admins have read-only access

All data access is delegated to ``HomeworkService``.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.homeworks import (
    CreateHomeworkRequest,
    HomeworkListResponse,
    HomeworkResponse,
    SubmissionListResponse,
    SubmissionResponse,
    ClassInfo,
    SubjectInfo,
    TeacherInfo,
    StudentInfo,
)
from app.core.database import get_db
from app.domain.academic.academic_calendar_service import (
    AcademicTermService,
    AcademicYearService,
)
from app.domain.homework.homework_service import HomeworkService
from app.models.homework import Homework
from app.models.homework_submission import HomeworkSubmission
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.repository.academic_term import AcademicTermRepository
from app.repository.academic_year import AcademicYearRepository
from app.repository.homework_repo import HomeworkRepository
from app.repository.homework_submission_repo import HomeworkSubmissionRepository
from app.repository.teacher_class_subject_repo import TeacherClassSubjectRepository
from pydantic import BaseModel, Field

logger = logging.getLogger("athon")

router = APIRouter(tags=["homework"])


# ── Phase D Schemas ─────────────────────────────────────────────


class GradeSubmissionRequest(BaseModel):
    """Request body for grading a homework submission."""

    total_score: float = Field(..., gt=0, description="Score awarded to the student")
    teacher_remarks: str | None = Field(None, max_length=2000, description="Teacher feedback")


class HomeworkDetailResponse(HomeworkResponse):
    """Homework response with questions included."""

    questions: list[dict] = Field(
        default_factory=list, description="Homework questions"
    )


class StudentHomeworkQuestionResponse(BaseModel):
    """Question response for students (correct_answer hidden)."""

    id: str = Field(..., description="Question UUID")
    question_number: int = Field(..., description="Question number")
    question_type: str = Field(..., description="Question type")
    question_text: str = Field(..., description="Question text")
    options: list[str] | None = Field(None, description="MCQ options")
    max_points: float = Field(..., description="Maximum points")


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


def _build_homework_response(hw: Homework) -> HomeworkResponse:
    """Convert a Homework ORM instance to a response schema."""
    resp = HomeworkResponse(
        id=str(hw.id),
        class_id=str(hw.class_id),
        subject_id=str(hw.subject_id),
        teacher_id=str(hw.teacher_id),
        academic_term_id=str(hw.academic_term_id),
        title=hw.title,
        description=hw.description,
        due_date=hw.due_date,
        max_score=float(hw.max_score) if hw.max_score else 100.0,
        is_published=hw.is_published,
        published_at=hw.published_at,
        version=hw.version,
        created_at=hw.created_at.isoformat() if hw.created_at else "",
        updated_at=hw.updated_at.isoformat() if hw.updated_at else "",
    )

    # Attach nested teacher info if loaded
    if hasattr(hw, "teacher") and hw.teacher is not None:
        teacher_user = hw.teacher.user if hasattr(hw.teacher, "user") else None
        resp.teacher = TeacherInfo(
            id=str(hw.teacher.id),
            name=(
                f"{teacher_user.first_name} {teacher_user.last_name}"
                if teacher_user
                else hw.teacher.employee_code
            ),
            employee_code=hw.teacher.employee_code,
        )

    # Attach nested class info if loaded
    if hasattr(hw, "class_") and hw.class_ is not None:
        resp.class_ = ClassInfo(
            id=str(hw.class_.id),
            name=hw.class_.name,
            section=hw.class_.section,
        )

    # Attach nested subject info if loaded
    if hasattr(hw, "subject") and hw.subject is not None:
        resp.subject = SubjectInfo(
            id=str(hw.subject.id),
            name=hw.subject.name,
            code=hw.subject.code,
        )

    return resp


def _build_submission_response(sub: HomeworkSubmission) -> SubmissionResponse:
    """Convert a HomeworkSubmission ORM instance to a response schema."""
    resp = SubmissionResponse(
        id=str(sub.id),
        homework_id=str(sub.homework_id),
        student_id=str(sub.student_id),
        status=sub.status.value if hasattr(sub.status, "value") else str(sub.status),
        submitted_at=sub.submitted_at,
        total_score=float(sub.total_score) if sub.total_score else None,
        is_graded=sub.is_graded,
        graded_by=str(sub.graded_by) if sub.graded_by else None,
        graded_at=sub.graded_at,
        teacher_remarks=sub.teacher_remarks,
        created_at=sub.created_at.isoformat() if sub.created_at else "",
        updated_at=sub.updated_at.isoformat() if sub.updated_at else "",
    )

    # Attach nested student info if loaded
    if hasattr(sub, "student") and sub.student is not None:
        student_user = sub.student.user if hasattr(sub.student, "user") else None
        resp.student = StudentInfo(
            id=str(sub.student.id),
            admission_number=sub.student.admission_number,
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


def _build_service(db: AsyncSession) -> HomeworkService:
    """Build a HomeworkService with its repository dependencies."""
    return HomeworkService(
        homework_repo=HomeworkRepository(db),
        submission_repo=HomeworkSubmissionRepository(db),
        tcs_repo=TeacherClassSubjectRepository(db),
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/homework",
    response_model=HomeworkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_homework(
    body: CreateHomeworkRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new homework assignment.

    Teachers can only create homework for classes they teach.
    """
    teacher_id = await _get_teacher_id_for_user(db, current_user)
    service = _build_service(db)

    try:
        homework = await service.create_homework(
            teacher_id=teacher_id,
            class_id=body.class_id,
            subject_id=body.subject_id,
            academic_term_id=body.academic_term_id,
            school_id=str(current_user.school_id),
            title=body.title,
            due_date=body.due_date,
            description=body.description,
            max_score=body.max_score,
            is_published=body.is_published,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return _build_homework_response(homework)


@router.get(
    "/homework/class/{class_id}",
    response_model=HomeworkListResponse,
)
async def get_class_homework(
    class_id: str,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str | None = Query(None, description="Filter by academic term"),
    include_unpublished: bool = Query(
        False, description="Include unpublished drafts (teachers/admins only)"
    ),
):
    """Get homework assignments for a class.

    Accessible by teachers, principals, and school admins.
    By default, only published homeworks are returned.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    resolved_term_id = academic_term_id or await _get_current_term_id(db, school_id)

    homeworks = await service.get_class_homework(
        class_id=class_id,
        school_id=school_id,
        academic_term_id=resolved_term_id,
        include_unpublished=include_unpublished,
    )

    return HomeworkListResponse(
        homeworks=[_build_homework_response(h) for h in homeworks],
        total=len(homeworks),
    )


@router.get(
    "/homework/student/me",
    response_model=HomeworkListResponse,
)
async def get_my_homework(
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
    academic_term_id: str | None = Query(None, description="Filter by academic term"),
):
    """Get published homework assignments for the authenticated student.

    Students see only published (not draft) homework for their class.
    """
    student_id, class_id = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)
    school_id = str(current_user.school_id)

    resolved_term_id = academic_term_id or await _get_current_term_id(db, school_id)

    homeworks = await service.get_student_homework(
        class_id=class_id,
        school_id=school_id,
        academic_term_id=resolved_term_id,
    )

    return HomeworkListResponse(
        homeworks=[_build_homework_response(h) for h in homeworks],
        total=len(homeworks),
    )


@router.post(
    "/homework/{homework_id}/submit",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_homework(
    homework_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Submit a homework assignment.

    Students can submit once per homework, before the due date,
    and only for published homeworks. Use ``PATCH`` to update
    an existing submission before the due date.
    """
    student_id, _ = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        submission = await service.submit_homework(
            student_id=student_id,
            homework_id=homework_id,
            school_id=school_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_submission_response(submission)


@router.patch(
    "/homework/{homework_id}/submit",
    response_model=SubmissionResponse,
)
async def update_homework_submission(
    homework_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Update a homework submission before the due date.

    Students can re-submit before the due date if the submission
    has not been graded yet. Use this endpoint to update answers
    or re-submit after making changes.
    """
    student_id, _ = await _get_student_id_and_class(db, current_user)
    service = _build_service(db)

    try:
        submission = await service.update_submission(
            student_id=student_id,
            homework_id=homework_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return _build_submission_response(submission)


@router.get(
    "/homework/{homework_id}/submissions",
    response_model=SubmissionListResponse,
)
async def get_homework_submissions(
    homework_id: str,
    current_user: User = Depends(require_role("teacher", "principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get all submissions for a specific homework.

    Teachers see only submissions for homeworks they created.
    Principals and admins have read-only access to all submissions.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    # Verify teacher owns this homework (unless principal/admin)
    from app.models.homework import Homework as HomeworkModel

    result = await db.execute(
        select(HomeworkModel).where(HomeworkModel.id == homework_id)
    )
    homework = result.scalar_one_or_none()
    if homework is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Homework not found",
        )

    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if role_str == "teacher":
        teacher_id = await _get_teacher_id_for_user(db, current_user)
        if str(homework.teacher_id) != teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only view submissions for their own homework",
            )

    submissions = await service.get_homework_submissions(
        homework_id=homework_id,
        school_id=school_id,
    )

    return SubmissionListResponse(
        submissions=[_build_submission_response(s) for s in submissions],
        total=len(submissions),
    )


# ── Phase D: Homework Detail ────────────────────────────────────


@router.get(
    "/homework/{homework_id}",
    response_model=HomeworkDetailResponse,
)
async def get_homework_detail(
    homework_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single homework with questions.

    Role-aware:
        - Teachers: see own homework (any status)
        - Students: see published homework for their class
        - Principals/admins: see any homework
    """
    school_id = str(current_user.school_id)
    repo = HomeworkRepository(db)

    # Use get_with_questions() to eagerly load questions
    hw = await repo.get_with_questions(homework_id)
    if hw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Homework not found",
        )

    # School isolation
    if str(hw.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Homework not found",
        )

    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    if role_str == "teacher":
        teacher_id = await _get_teacher_id_for_user(db, current_user)
        if str(hw.teacher_id) != teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only view their own homework",
            )
    elif role_str == "student":
        if not hw.is_published:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Homework is not yet published",
            )

    # Build response with questions
    resp = _build_homework_response(hw)
    detail = HomeworkDetailResponse(**resp.model_dump())

    # Include questions (already eager-loaded via get_with_questions)
    if hasattr(hw, "questions") and hw.questions:
        for q in hw.questions:
            q_data = {
                "id": str(q.id),
                "question_number": q.question_number,
                "question_type": q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                "question_text": q.question_text,
                "options": q.options,
                "max_points": float(q.max_points) if q.max_points else 0,
            }
            # Hide correct_answer from students
            if role_str != "student":
                q_data["correct_answer"] = q.correct_answer
                q_data["explanation"] = q.explanation
            detail.questions.append(q_data)

    return detail


# ── Phase D: Homework Grading ───────────────────────────────────


@router.patch(
    "/homework/{homework_id}/submissions/{submission_id}/grade",
    response_model=SubmissionResponse,
)
async def grade_submission(
    homework_id: str,
    submission_id: str,
    body: GradeSubmissionRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Grade a student's homework submission.

    Teachers can only grade submissions for homework they created.
    Submissions must be in "submitted" status (not already graded).
    """
    teacher_id = await _get_teacher_id_for_user(db, current_user)

    # Verify teacher owns the homework
    repo = HomeworkRepository(db)
    hw = await repo.get(homework_id)
    if hw is None or str(hw.teacher_id) != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers can only grade their own homework submissions",
        )

    # Find the submission
    sub_repo = HomeworkSubmissionRepository(db)
    sub = await sub_repo.get(submission_id)
    if sub is None or str(sub.homework_id) != homework_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    if sub.is_graded:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This submission has already been graded",
        )

    now = datetime.now(timezone.utc)
    await sub_repo.update(
        submission_id,
        total_score=body.total_score,
        is_graded=True,
        graded_by=current_user.id,
        graded_at=now,
        teacher_remarks=body.teacher_remarks,
        status="graded",
    )

    # Re-fetch to get updated state
    updated = await sub_repo.get(submission_id)
    return _build_submission_response(updated)


# ── Phase D: Student Question Access ────────────────────────────


@router.get(
    "/homework/{homework_id}/questions",
    response_model=list[StudentHomeworkQuestionResponse],
)
async def get_homework_questions(
    homework_id: str,
    current_user: User = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db),
):
    """Get homework questions for a student (correct_answer hidden).

    Students can only view questions for published homeworks
    that are assigned to their class.
    """
    student_id, class_id = await _get_student_id_and_class(db, current_user)
    school_id = str(current_user.school_id)

    # Verify homework is published and for their class
    homework_repo = HomeworkRepository(db)
    hw = await homework_repo.get(homework_id)
    if hw is None or str(hw.school_id) != school_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Homework not found",
        )

    if not hw.is_published:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Homework is not yet published",
        )

    if str(hw.class_id) != class_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This homework is not assigned to your class",
        )

    # Fetch with questions
    hw_with_q = await homework_repo.get_with_questions(homework_id)

    questions = []
    if hw_with_q and hasattr(hw_with_q, "questions") and hw_with_q.questions:
        for q in hw_full.questions:
            questions.append(
                StudentHomeworkQuestionResponse(
                    id=str(q.id),
                    question_number=q.question_number,
                    question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                    question_text=q.question_text,
                    options=q.options,
                    max_points=float(q.max_points) if q.max_points else 0,
                )
            )

    return questions
