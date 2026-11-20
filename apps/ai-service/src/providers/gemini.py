"""Gemini LLM Provider using Google Gemini REST/SDK API."""

import json
from typing import TypeVar

import httpx
from pydantic import BaseModel

from src.config import settings
from src.providers.base import LLMProvider
from src.providers.mock import MockLLMProvider

T = TypeVar("T", bound=BaseModel)


class GeminiLLMProvider(LLMProvider):
    """Google Gemini LLM provider with graceful mock fallback."""

    name: str = "gemini"

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.mock_fallback = MockLLMProvider()

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        if not self.api_key:
            return await self.mock_fallback.generate_text(system_prompt, user_prompt, temperature)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"temperature": temperature},
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                # Fallback to mock if API returns error (e.g. rate limit, quota, invalid key)
                return await self.mock_fallback.generate_text(
                    system_prompt, user_prompt, temperature
                )
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
        temperature: float = 0.2,
    ) -> T:
        if not self.api_key:
            return await self.mock_fallback.generate_json(
                system_prompt, user_prompt, schema, temperature
            )

        json_prompt = (
            f"{system_prompt}\n\nYou MUST respond with valid JSON matching this schema: "
            f"{json.dumps(schema.model_json_schema())}"
        )

        raw_text = await self.generate_text(json_prompt, user_prompt, temperature)
        # Extract json from potential markdown fences
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        parsed = json.loads(cleaned.strip())
        return schema.model_validate(parsed)

    async def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        # Default to local deterministic MiniLM embeddings for speed and consistency
        return await self.mock_fallback.get_embeddings(texts)
