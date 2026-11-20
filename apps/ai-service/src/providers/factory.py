"""Factory for obtaining configured LLM Provider singleton."""

from src.config import settings
from src.providers.base import LLMProvider
from src.providers.gemini import GeminiLLMProvider
from src.providers.mock import MockLLMProvider

_cached_provider: LLMProvider | None = None


def get_llm_provider(provider_type: str | None = None) -> LLMProvider:
    """Get or create singleton LLM provider based on configuration or explicit parameter."""
    global _cached_provider

    chosen_type = (provider_type or settings.llm_provider).lower().strip()

    if _cached_provider is not None and _cached_provider.name == chosen_type:
        return _cached_provider

    if chosen_type == "gemini":
        _cached_provider = GeminiLLMProvider()
    elif chosen_type == "mock":
        _cached_provider = MockLLMProvider(embedding_dim=settings.embedding_dim)
    else:
        # Default to mock
        _cached_provider = MockLLMProvider(embedding_dim=settings.embedding_dim)

    return _cached_provider


def set_llm_provider(provider: LLMProvider | None) -> None:
    """Override singleton LLM provider for testing."""
    global _cached_provider
    _cached_provider = provider
