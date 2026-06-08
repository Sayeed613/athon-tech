"""AI generation endpoints."""

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
            detail=f"AI generation failed: {str(exc)}",
        )
