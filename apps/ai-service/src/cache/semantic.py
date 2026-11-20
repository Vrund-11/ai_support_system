"""Semantic response cache in Redis with KB invalidation (AI-7)."""

import hashlib
import json
import logging
import re
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis

from src.config import settings
from src.schemas.llm import CitationItem, GenerateAnswerResponse

logger = logging.getLogger(__name__)


def normalize_question(question: str) -> str:
    """Normalize question by lowercasing, stripping punctuation, and collapsing whitespace."""
    cleaned = re.sub(r"[^\w\s]", "", question.lower())
    return " ".join(cleaned.split())


def question_hash(normalized_text: str) -> str:
    """Deterministic SHA-256 hash of normalized question."""
    return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2, strict=True))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class BaseSemanticCache(ABC):
    """Abstract interface for semantic response caching."""

    @abstractmethod
    async def get(
        self,
        tenant_id: str,
        question: str,
        query_embedding: list[float] | None = None,
        similarity_threshold: float = 0.95,
    ) -> GenerateAnswerResponse | None:
        raise NotImplementedError

    @abstractmethod
    async def set(
        self,
        tenant_id: str,
        question: str,
        response: GenerateAnswerResponse,
        query_embedding: list[float] | None = None,
        ttl_seconds: int = 86400,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    async def invalidate_tenant(self, tenant_id: str) -> int:
        """Invalidate all cached responses for tenant on KB change."""
        raise NotImplementedError

    @abstractmethod
    async def clear(self) -> None:
        raise NotImplementedError


class MemorySemanticCache(BaseSemanticCache):
    """In-memory cache for fast unit tests without external Redis dependencies."""

    def __init__(self) -> None:
        # (tenant_id, hash) -> dict
        self._entries: dict[tuple[str, str], dict[str, Any]] = {}

    async def get(
        self,
        tenant_id: str,
        question: str,
        query_embedding: list[float] | None = None,
        similarity_threshold: float = 0.95,
    ) -> GenerateAnswerResponse | None:
        norm = normalize_question(question)
        qhash = question_hash(norm)

        # 1. Exact normalized hash match
        key = (tenant_id, qhash)
        if key in self._entries:
            data = self._entries[key]
            return self._to_response(data)

        # 2. Semantic vector similarity match across tenant entries
        if query_embedding:
            for (t_id, _), data in self._entries.items():
                if t_id == tenant_id and data.get("embedding"):
                    sim = cosine_similarity(query_embedding, data["embedding"])
                    if sim >= similarity_threshold:
                        logger.info(
                            "Semantic cache hit (similarity: %.3f >= threshold: %.3f)",
                            sim,
                            similarity_threshold,
                        )
                        return self._to_response(data)

        return None

    async def set(
        self,
        tenant_id: str,
        question: str,
        response: GenerateAnswerResponse,
        query_embedding: list[float] | None = None,
        ttl_seconds: int = 86400,
    ) -> None:
        norm = normalize_question(question)
        qhash = question_hash(norm)
        key = (tenant_id, qhash)
        self._entries[key] = {
            "question": question,
            "normalized": norm,
            "embedding": query_embedding,
            "answer": response.answer,
            "citations": [c.model_dump() for c in response.citations],
            "confidence": response.confidence,
            "should_escalate": response.should_escalate,
            "reason": response.reason,
            "cached_at": datetime.now(UTC).isoformat(),
        }

    async def invalidate_tenant(self, tenant_id: str) -> int:
        keys_to_del = [k for k in self._entries if k[0] == tenant_id]
        for k in keys_to_del:
            del self._entries[k]
        logger.info(
            "Invalidated %d semantic cache keys for tenant '%s'", len(keys_to_del), tenant_id
        )
        return len(keys_to_del)

    async def clear(self) -> None:
        self._entries.clear()

    @staticmethod
    def _to_response(data: dict[str, Any]) -> GenerateAnswerResponse:
        citations = [CitationItem(**c) for c in data.get("citations", [])]
        return GenerateAnswerResponse(
            answer=data["answer"],
            citations=citations,
            confidence=data["confidence"],
            should_escalate=data["should_escalate"],
            reason=data.get("reason"),
            provider="cache",
            tokens_used=0,
        )


class RedisSemanticCache(BaseSemanticCache):
    """Production Redis semantic response cache with TTL and prefix scanning."""

    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url or settings.redis_url
        self._client: aioredis.Redis | None = None

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._client

    async def get(
        self,
        tenant_id: str,
        question: str,
        query_embedding: list[float] | None = None,
        similarity_threshold: float = 0.95,
    ) -> GenerateAnswerResponse | None:
        norm = normalize_question(question)
        qhash = question_hash(norm)
        key = f"ai:cache:{tenant_id}:{qhash}"

        try:
            client = await self._get_client()
            raw = await client.get(key)
            if raw:
                data = json.loads(raw)
                return MemorySemanticCache._to_response(data)

            # Optional scan for semantic vector match if embedding provided
            if query_embedding:
                pattern = f"ai:cache:{tenant_id}:*"
                cursor = 0
                while True:
                    cursor, keys = await client.scan(cursor, match=pattern, count=20)
                    for k in keys:
                        item_raw = await client.get(k)
                        if item_raw:
                            item_data = json.loads(item_raw)
                            emb = item_data.get("embedding")
                            if (
                                emb
                                and cosine_similarity(query_embedding, emb)
                                >= similarity_threshold
                            ):
                                return MemorySemanticCache._to_response(item_data)
                    if cursor == 0:
                        break

            return None
        except Exception as exc:
            logger.warning("Redis semantic cache get failed: %s", str(exc))
            return None

    async def set(
        self,
        tenant_id: str,
        question: str,
        response: GenerateAnswerResponse,
        query_embedding: list[float] | None = None,
        ttl_seconds: int = 86400,
    ) -> None:
        norm = normalize_question(question)
        qhash = question_hash(norm)
        key = f"ai:cache:{tenant_id}:{qhash}"

        payload = {
            "question": question,
            "normalized": norm,
            "embedding": query_embedding,
            "answer": response.answer,
            "citations": [c.model_dump() for c in response.citations],
            "confidence": response.confidence,
            "should_escalate": response.should_escalate,
            "reason": response.reason,
            "cached_at": datetime.now(UTC).isoformat(),
        }

        try:
            client = await self._get_client()
            await client.set(key, json.dumps(payload), ex=ttl_seconds)
        except Exception as exc:
            logger.warning("Redis semantic cache set failed: %s", str(exc))

    async def invalidate_tenant(self, tenant_id: str) -> int:
        pattern = f"ai:cache:{tenant_id}:*"
        deleted_count = 0
        try:
            client = await self._get_client()
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor, match=pattern, count=50)
                if keys:
                    await client.delete(*keys)
                    deleted_count += len(keys)
                if cursor == 0:
                    break
            logger.info(
                "Invalidated %d semantic cache keys for tenant '%s'", deleted_count, tenant_id
            )
            return deleted_count
        except Exception as exc:
            logger.warning("Redis semantic cache invalidation failed: %s", str(exc))
            return 0

    async def clear(self) -> None:
        try:
            client = await self._get_client()
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor, match="ai:cache:*", count=50)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as exc:
            logger.warning("Redis cache clear failed: %s", str(exc))


# Default global cache instance
_active_cache: BaseSemanticCache = MemorySemanticCache()


def get_semantic_cache() -> BaseSemanticCache:
    return _active_cache


def set_semantic_cache(cache: BaseSemanticCache) -> None:
    global _active_cache
    _active_cache = cache
