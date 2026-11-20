"""Semantic caching module (AI-7)."""

from src.cache.semantic import (
    BaseSemanticCache,
    MemorySemanticCache,
    RedisSemanticCache,
    get_semantic_cache,
    normalize_question,
    set_semantic_cache,
)

__all__ = [
    "BaseSemanticCache",
    "MemorySemanticCache",
    "RedisSemanticCache",
    "get_semantic_cache",
    "normalize_question",
    "set_semantic_cache",
]
