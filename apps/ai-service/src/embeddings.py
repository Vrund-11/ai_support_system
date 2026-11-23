"""Pluggable embedding provider interface and implementations."""

from __future__ import annotations

import asyncio
import hashlib
import math
from typing import Protocol, runtime_checkable

from src.config import settings


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Protocol for vector embedding providers."""

    name: str
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Compute normalized vector embeddings synchronously for batch of strings."""
        ...

    async def aembed(self, texts: list[str]) -> list[list[float]]:
        """Compute normalized vector embeddings asynchronously for batch of strings."""
        ...


class SbertProvider:
    """Sentence-Transformers provider using all-MiniLM-L6-v2 (dim 384)."""

    name: str = "sbert"

    def __init__(self, model_name: str | None = None, dim: int = 384) -> None:
        self.model_name = model_name or settings.embedding_model
        self.dim = dim
        self._model = None

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        model = self._load_model()
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]

    async def aembed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.embed, texts)


class MockProvider:
    """Deterministic hash-based unit-normalized mock embedding provider for tests."""

    name: str = "mock"

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for text in texts:
            text_bytes = text.strip().lower().encode("utf-8")
            hash_digest = hashlib.sha256(text_bytes).digest()

            raw_floats: list[float] = []
            for i in range(self.dim):
                byte_val = hash_digest[i % len(hash_digest)]
                val = math.sin((byte_val + i * 31) / 256.0 * math.pi)
                raw_floats.append(val)

            norm = math.sqrt(sum(x * x for x in raw_floats))
            normalized = [round(x / norm, 6) for x in raw_floats] if norm > 0 else [0.0] * self.dim
            results.append(normalized)
        return results

    async def aembed(self, texts: list[str]) -> list[list[float]]:
        return self.embed(texts)


_provider_instances: dict[str, EmbeddingProvider] = {}


def get_embedding_provider(provider_type: str | None = None) -> EmbeddingProvider:
    """Get or create configured embedding provider."""
    provider_name = (provider_type or settings.embedding_provider or "sbert").lower()

    if provider_name in _provider_instances:
        return _provider_instances[provider_name]

    if provider_name == "mock":
        instance = MockProvider(dim=settings.embedding_dim)
    elif provider_name in ("sbert", "sentence-transformers"):
        instance = SbertProvider(model_name=settings.embedding_model, dim=settings.embedding_dim)
    else:
        instance = SbertProvider(model_name=settings.embedding_model, dim=settings.embedding_dim)

    _provider_instances[provider_name] = instance
    return instance
