"""AI service — orchestrates content generation via OpenAI provider."""

import logging
from app.infrastructure.ai.openai_provider import OpenAIProvider
from app.domain.ai.prompt_templates import (
    HOMEWORK_SYSTEM_PROMPT,
    HOMEWORK_USER_PROMPT,
    TEST_SYSTEM_PROMPT,
    TEST_USER_PROMPT,
    REPORT_COMMENT_SYSTEM_PROMPT,
    REPORT_COMMENT_USER_PROMPT,
    PARENT_REPORT_SYSTEM_PROMPT,
    PARENT_REPORT_USER_PROMPT,
)

logger = logging.getLogger("athon")


class AIService:
    """Service for AI content generation."""

    def __init__(self) -> None:
        self._provider = OpenAIProvider()

    async def generate_homework(
        self,
        subject_name: str,
        class_name: str,
        chapter_topic: str,
        question_count: int = 5,
        question_types: list[str] | None = None,
    ) -> dict:
        """Generate CBSE-aligned homework questions."""
        if question_types is None:
            question_types = ["multiple_choice", "short_answer"]

        user_prompt = HOMEWORK_USER_PROMPT.format(
            question_count=question_count,
            subject_name=subject_name,
            class_name=class_name,
            chapter_topic=chapter_topic,
            question_types=", ".join(question_types),
        )

        try:
            return await self._provider.generate_json(
                system_prompt=HOMEWORK_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception as exc:
            logger.error("AI homework generation failed: %s", exc)
            raise

    async def generate_test(
        self,
        class_name: str,
        subject_name: str,
        chapter_topic: str,
        test_type: str = "class_test",
        question_count: int = 10,
        total_marks: int = 20,
        duration_minutes: int = 40,
        difficulty: str = "medium",
    ) -> dict:
        """Generate a CBSE-aligned test paper."""
        user_prompt = TEST_USER_PROMPT.format(
            test_type=test_type.replace("_", " "),
            question_count=question_count,
            class_name=class_name,
            subject_name=subject_name,
            chapter_topic=chapter_topic,
            total_marks=total_marks,
            duration_minutes=duration_minutes,
            difficulty=difficulty,
        )
        try:
            return await self._provider.generate_json(
                system_prompt=TEST_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception as exc:
            logger.error("AI test generation failed: %s", exc)
            raise

    async def generate_report_comment(
        self,
        student_name: str,
        subject_name: str,
        class_name: str,
        attendance_pct: float,
        attended: int,
        total: int,
        homework_pct: float,
        test_avg: float,
        test_high: float,
        test_low: float,
        tone: str = "formal",
    ) -> str:
        """Generate a personalized report card comment."""
        user_prompt = REPORT_COMMENT_USER_PROMPT.format(
            student_name=student_name,
            subject_name=subject_name,
            class_name=class_name,
            attendance_pct=round(attendance_pct, 1),
            attended=attended,
            total=total,
            homework_pct=round(homework_pct, 1),
            test_avg=round(test_avg, 1),
            test_high=round(test_high, 1),
            test_low=round(test_low, 1),
            tone=tone,
        )
        try:
            return await self._provider.generate_text(
                system_prompt=REPORT_COMMENT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception as exc:
            logger.error("Report comment generation failed: %s", exc)
            raise

    async def generate_parent_report(
        self,
        student_name: str,
        class_name: str,
        week_dates: str,
        attended: int,
        total_days: int,
        hw_submitted: int,
        hw_total: int,
        test_summary: str,
        teacher_note: str = "",
        language: str = "English",
    ) -> str:
        """Generate a WhatsApp-ready weekly parent report."""
        system_prompt = PARENT_REPORT_SYSTEM_PROMPT.format(language=language)
        user_prompt = PARENT_REPORT_USER_PROMPT.format(
            student_name=student_name,
            class_name=class_name,
            week_dates=week_dates,
            attended=attended,
            total_days=total_days,
            hw_submitted=hw_submitted,
            hw_total=hw_total,
            test_summary=test_summary,
            teacher_note=teacher_note,
        )
        try:
            return await self._provider.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        except Exception as exc:
            logger.error("Parent report generation failed: %s", exc)
            raise
