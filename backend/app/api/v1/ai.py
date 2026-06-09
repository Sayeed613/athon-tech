"""AI generation endpoints — homework, tests, report comments."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.core.database import get_db
from app.domain.ai.ai_service import AIService
from app.models.user import User

logger = logging.getLogger("athon")
router = APIRouter(tags=["ai"])


class GenerateHomeworkRequest(BaseModel):
    subject_name: str = Field(..., description="Subject name e.g. Mathematics")
    class_name: str = Field(..., description="Class name e.g. Grade 9A")
    chapter_topic: str = Field(..., description="Chapter or topic name")
    question_count: int = Field(5, ge=1, le=20, description="Number of questions")
    question_types: list[str] = Field(
        default=["multiple_choice", "short_answer"],
        description="Types of questions to generate"
    )


class GenerateTestRequest(BaseModel):
    class_name: str = Field(..., description="Class name e.g. Grade 9A")
    subject_name: str = Field(..., description="Subject name e.g. Mathematics")
    chapter_topic: str = Field(..., description="Chapter or topic name")
    test_type: str = Field("class_test", description="Type: quiz, class_test, midterm, final, mock")
    question_count: int = Field(10, ge=3, le=30, description="Number of questions")
    total_marks: int = Field(20, ge=5, le=100, description="Total marks")
    duration_minutes: int = Field(40, ge=20, le=180, description="Duration in minutes")
    difficulty: str = Field("medium", description="easy, medium, hard")


class GenerateReportCommentRequest(BaseModel):
    student_name: str = Field(..., description="Student's full name")
    subject_name: str = Field(..., description="Subject name")
    class_name: str = Field(..., description="Class name")
    attendance_pct: float = Field(..., ge=0, le=100, description="Attendance percentage")
    attended: int = Field(..., ge=0, description="Days attended")
    total: int = Field(..., ge=1, description="Total school days")
    homework_pct: float = Field(..., ge=0, le=100, description="Homework completion rate")
    test_avg: float = Field(..., ge=0, le=100, description="Average test score")
    test_high: float = Field(..., ge=0, le=100, description="Highest test score")
    test_low: float = Field(..., ge=0, le=100, description="Lowest test score")
    tone: str = Field("formal", description="formal or warm")


@router.post("/ai/generate-homework")
async def generate_homework(
    body: GenerateHomeworkRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI homework questions for a teacher."""
    service = AIService()
    try:
        result = await service.generate_homework(
            subject_name=body.subject_name,
            class_name=body.class_name,
            chapter_topic=body.chapter_topic,
            question_count=body.question_count,
            question_types=body.question_types,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI generation failed: {str(exc)[:200]}",
        )


@router.post("/ai/generate-test")
async def generate_test(
    body: GenerateTestRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI test questions. Teacher-only."""
    service = AIService()
    try:
        result = await service.generate_test(
            class_name=body.class_name,
            subject_name=body.subject_name,
            chapter_topic=body.chapter_topic,
            test_type=body.test_type,
            question_count=body.question_count,
            total_marks=body.total_marks,
            duration_minutes=body.duration_minutes,
            difficulty=body.difficulty,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI test generation failed: {str(exc)[:200]}",
        )


@router.post("/ai/generate-report-comment")
async def generate_report_comment(
    body: GenerateReportCommentRequest,
    current_user: User = Depends(require_role("teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI report card comment. Teacher-only."""
    service = AIService()
    try:
        comment = await service.generate_report_comment(
            student_name=body.student_name,
            subject_name=body.subject_name,
            class_name=body.class_name,
            attendance_pct=body.attendance_pct,
            attended=body.attended,
            total=body.total,
            homework_pct=body.homework_pct,
            test_avg=body.test_avg,
            test_high=body.test_high,
            test_low=body.test_low,
            tone=body.tone,
        )
        return {"comment": comment}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI report comment generation failed: {str(exc)[:200]}",
        )
