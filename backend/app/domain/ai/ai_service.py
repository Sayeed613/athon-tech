"""AI service for content generation."""

import logging
from app.infrastructure.ai.openai_provider import OpenAIProvider
from app.domain.ai.prompt_templates import (
    HOMEWORK_SYSTEM_PROMPT,
    HOMEWORK_USER_PROMPT,
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
        """Generate homework questions for a given class, subject, and topic."""
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
            result = await self._provider.generate_json(
                system_prompt=HOMEWORK_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
            return result
        except Exception as exc:
            logger.error("AI homework generation failed: %s", exc)
            raise
