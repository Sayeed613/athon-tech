"""OpenAI provider for AI content generation."""

import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("athon")


class OpenAIProvider:
    """Async OpenAI client wrapper."""

    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate_text(self, system_prompt: str, user_prompt: str, model: str = "gpt-4o-mini") -> str:
        """Generate text completion."""
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=2000,
        )
        return response.choices[0].message.content or ""

    async def generate_json(self, system_prompt: str, user_prompt: str, model: str = "gpt-4o-mini") -> dict:
        """Generate structured JSON output."""
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt + "\n\nRespond with valid JSON only. No markdown, no preamble."},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=3000,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)
