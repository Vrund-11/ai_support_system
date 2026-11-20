"""Tests for LLM Provider interface, Mock provider, and factory."""

import math

import pytest

from src.providers.factory import get_llm_provider
from src.providers.mock import MockLLMProvider
from src.schemas.llm import CitationItem, RagAnswer


@pytest.mark.asyncio
async def test_mock_generate_text():
    provider = MockLLMProvider()
    text = await provider.generate_text(
        system_prompt="You are a support bot.",
        user_prompt="How do I reset my password?",
    )
    assert isinstance(text, str)
    assert len(text) > 10
    assert "password" in text.lower() or "supportpilot" in text.lower()


@pytest.mark.asyncio
async def test_mock_generate_json_rag_answer():
    provider = MockLLMProvider()
    answer = await provider.generate_json(
        system_prompt="Answer using context.",
        user_prompt="What are your business hours?",
        schema=RagAnswer,
    )
    assert isinstance(answer, RagAnswer)
    assert len(answer.answer) > 0
    assert answer.confidence >= 0.8
    assert answer.should_escalate is False
    assert len(answer.citations) > 0
    assert answer.citations[0].doc_id == "doc-kb-001"


@pytest.mark.asyncio
async def test_mock_low_confidence_simulation():
    provider = MockLLMProvider()
    provider.simulate_low_confidence = True

    answer = await provider.generate_json(
        system_prompt="Answer question.",
        user_prompt="Complex undefined question",
        schema=RagAnswer,
    )
    assert isinstance(answer, RagAnswer)
    assert answer.confidence < 0.55
    assert answer.should_escalate is True
    assert answer.reason is not None


@pytest.mark.asyncio
async def test_mock_malformed_json_simulation():
    provider = MockLLMProvider()
    provider.simulate_malformed_json = True

    with pytest.raises(ValueError, match="Simulated malformed JSON"):
        await provider.generate_json(
            system_prompt="Prompt",
            user_prompt="Question",
            schema=RagAnswer,
        )


@pytest.mark.asyncio
async def test_mock_custom_answer_override():
    provider = MockLLMProvider()
    provider.custom_answer = "Custom predetermined answer"
    provider.custom_citations = [CitationItem(chunk_id="c1", doc_id="d1", title="Custom Guide")]

    answer = await provider.generate_json(
        system_prompt="System",
        user_prompt="User",
        schema=RagAnswer,
    )
    assert answer.answer == "Custom predetermined answer"
    assert answer.citations[0].title == "Custom Guide"


@pytest.mark.asyncio
async def test_mock_embeddings_dimensions_and_normalization():
    provider = MockLLMProvider(embedding_dim=384)
    texts = [
        "How do I reset my account password?",
        "What is the refund policy for annual subscriptions?",
        "SupportPilot setup guide",
    ]

    embeddings = await provider.get_embeddings(texts)
    assert len(embeddings) == 3

    for vec in embeddings:
        assert len(vec) == 384
        # Verify unit normalization: sqrt(sum(x^2)) ~= 1.0
        l2_norm = math.sqrt(sum(x * x for x in vec))
        assert abs(l2_norm - 1.0) < 1e-4


@pytest.mark.asyncio
async def test_mock_embeddings_deterministic():
    provider = MockLLMProvider()
    vec1 = await provider.get_embeddings(["Identical sentence for test"])
    vec2 = await provider.get_embeddings(["Identical sentence for test"])
    assert vec1 == vec2

    vec_diff = await provider.get_embeddings(["Completely different content"])
    assert vec1 != vec_diff


def test_provider_factory():
    mock_prov = get_llm_provider("mock")
    assert mock_prov.name == "mock"

    gemini_prov = get_llm_provider("gemini")
    assert gemini_prov.name == "gemini"
