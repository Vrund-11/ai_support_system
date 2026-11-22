"""Base abstract LLM Provider interface."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMProvider(ABC):
    """Abstract interface for LLM providers (Mock, Gemini, OpenAI)."""

    name: str = "base"

    @abstractmethod
    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> str:
        """Generate raw text response from prompt."""
        pass

    @abstractmethod
    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
        temperature: float = 0.2,
    ) -> T:
        """Generate structured JSON response parsed into Pydantic schema."""
        pass

    @abstractmethod
    async def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Compute normalized vector embeddings for a batch of text strings."""
        pass

    @abstractmethod
    async def stream_generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
    ) -> AsyncIterator[str]:
        """Stream generated text tokens asynchronously."""
        pass
