"""Tests for semantic cache and KB invalidation (AI-7)."""

import pytest
from fastapi.testclient import TestClient

from src.cache.semantic import (
    MemorySemanticCache,
    normalize_question,
    question_hash,
    set_semantic_cache,
)
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import MemoryIngestRepository, set_ingest_repository
from src.main import app
from src.providers.mock import MockLLMProvider
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import CitationItem, GenerateAnswerRequest, GenerateAnswerResponse


@pytest.fixture(autouse=True)
def setup_cache_and_repo():
    cache = MemorySemanticCache()
    set_semantic_cache(cache)
    repo = MemoryIngestRepository()
    set_ingest_repository(repo)
    yield cache, repo


def test_question_normalization():
    """Verify normalization strips punctuation, whitespace, and lowercases."""
    q1 = "How do I reset my password?"
    q2 = "how   do i reset my password"
    q3 = "HOW DO I RESET MY PASSWORD???"
    q4 = "How, do I reset - my password!"

    norm1 = normalize_question(q1)
    norm2 = normalize_question(q2)
    norm3 = normalize_question(q3)
    norm4 = normalize_question(q4)

    assert norm1 == "how do i reset my password"
    assert norm1 == norm2 == norm3 == norm4
    assert question_hash(norm1) == question_hash(norm3)


@pytest.mark.asyncio
async def test_cache_set_and_get(setup_cache_and_repo):
    """Verify cache stores and retrieves responses with provider set to 'cache'."""
    cache, _ = setup_cache_and_repo

    response = GenerateAnswerResponse(
        answer="Click Settings > Reset Password.",
        citations=[CitationItem(chunk_id="c1", doc_id="d1", title="Guide")],
        confidence=0.92,
        should_escalate=False,
        provider="mock",
    )

    await cache.set(
        tenant_id="tenant-1",
        question="How do I reset my password?",
        response=response,
    )

    # Fetch with different casing and punctuation
    hit = await cache.get(
        tenant_id="tenant-1",
        question="how do i reset my password??",
    )
    assert hit is not None
    assert hit.answer == "Click Settings > Reset Password."
    assert hit.provider == "cache"
    assert hit.confidence == 0.92


@pytest.mark.asyncio
async def test_cache_cross_tenant_isolation(setup_cache_and_repo):
    """Verify cached response from Tenant A is never accessible to Tenant B."""
    cache, _ = setup_cache_and_repo

    response = GenerateAnswerResponse(
        answer="Confidential Tenant A response.",
        citations=[],
        confidence=0.95,
        should_escalate=False,
        provider="mock",
    )

    await cache.set(
        tenant_id="tenant-A",
        question="What is the billing cycle?",
        response=response,
    )

    # Query as Tenant B
    tenant_b_hit = await cache.get(
        tenant_id="tenant-B",
        question="What is the billing cycle?",
    )
    assert tenant_b_hit is None


@pytest.mark.asyncio
async def test_cache_invalidation_on_kb_change(setup_cache_and_repo):
    """Verify KB document ingestion automatically clears tenant cache entries."""
    cache, repo = setup_cache_and_repo
    provider = MockLLMProvider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=provider)

    # 1. Populate cache
    cached_resp = GenerateAnswerResponse(
        answer="Old cached answer",
        citations=[],
        confidence=0.9,
        should_escalate=False,
        provider="mock",
    )
    await cache.set("tenant-kb", "How do refunds work?", cached_resp)

    # Verify hit
    assert await cache.get("tenant-kb", "How do refunds work?") is not None

    # 2. Ingest updated KB document for tenant-kb
    await pipeline.ingest_document(
        tenant_id="tenant-kb",
        document_id="doc-refunds-v2",
        title="Updated Refunds Policy",
        raw_text="All refunds are processed within 48 hours to the original payment method.",
    )

    # 3. Cache must be invalidated!
    hit_after = await cache.get("tenant-kb", "How do refunds work?")
    assert hit_after is None


@pytest.mark.asyncio
async def test_rag_service_end_to_end_caching(setup_cache_and_repo):
    """Verify RagService returns LLM on first call and 'cache' on subsequent identical call."""
    cache, repo = setup_cache_and_repo
    provider = MockLLMProvider()
    provider.custom_answer = "First generated answer"
    provider.custom_citations = [CitationItem(chunk_id="chunk-1", doc_id="d1", title="Doc")]

    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    service = RagService(retriever=retriever, llm_provider=provider, cache=cache)

    req = GenerateAnswerRequest(
        tenant_id="tenant-rag",
        question="How do I change email?",
        retrieved_chunks=[
            {
                "id": "chunk-1",
                "document_id": "d1",
                "chunk_index": 0,
                "content": "Change email in account settings.",
                "score": 0.95,
                "vector_score": 0.95,
            }
        ],
    )

    # Call 1: Miss -> generated by mock LLM
    res1 = await service.generate_answer(req)
    assert res1.provider == "mock"
    assert res1.answer == "First generated answer"

    # Call 2: Hit -> served from cache
    res2 = await service.generate_answer(req)
    assert res2.provider == "cache"
    assert res2.answer == "First generated answer"


def test_api_cache_invalidate_endpoint(setup_cache_and_repo):
    """Test POST /v1/cache/invalidate HTTP endpoint."""
    client = TestClient(app)

    resp = client.post(
        "/v1/cache/invalidate",
        json={"tenant_id": "api-tenant-cache"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tenant_id"] == "api-tenant-cache"
    assert "invalidated_count" in data
