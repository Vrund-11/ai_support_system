"""Tests for tenant call and token quota tracking and graceful degradation (AI-8)."""

import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.ingest.repository import MemoryIngestRepository, set_ingest_repository
from src.main import app
from src.providers.mock import MockLLMProvider
from src.quota import (
    MemoryQuotaTracker,
    set_quota_tracker,
)
from src.quota.tracker import build_quota_key, get_current_date
from src.rag.service import RagService
from src.schemas.llm import GenerateAnswerRequest


@pytest.fixture(autouse=True)
def setup_test_environment():
    repo = MemoryIngestRepository()
    set_ingest_repository(repo)
    tracker = MemoryQuotaTracker()
    set_quota_tracker(tracker)
    yield
    tracker._usage.clear()
    tracker._limits.clear()


def test_quota_key_format():
    """Verify key follows exact specification: quota:tenant:{tenant_id}:{date}."""
    today = get_current_date()
    key = build_quota_key("tenant_alpha_123")
    assert key == f"quota:tenant:tenant_alpha_123:{today}"

    custom_key = build_quota_key("tenant_beta", "2026-11-20")
    assert custom_key == "quota:tenant:tenant_beta:2026-11-20"


@pytest.mark.asyncio
async def test_quota_tracker_usage_and_limits():
    """Verify call and token tracking, limit enforcement, and reset."""
    tracker = MemoryQuotaTracker()
    tenant_id = "tenant_limit_test"

    # Set tight limits: max 3 calls or 500 tokens
    await tracker.set_tenant_limits(tenant_id, max_calls=3, max_tokens=500)

    # Initial state
    assert not await tracker.is_quota_exceeded(tenant_id)

    # Call 1: 100 tokens
    await tracker.increment_usage(tenant_id, calls=1, tokens=100)
    usage = await tracker.get_usage(tenant_id)
    assert usage["calls"] == 1
    assert usage["tokens"] == 100
    assert not await tracker.is_quota_exceeded(tenant_id)

    # Call 2: 150 tokens (total calls=2, tokens=250)
    await tracker.increment_usage(tenant_id, calls=1, tokens=150)
    assert not await tracker.is_quota_exceeded(tenant_id)

    # Call 3: reaches max_calls (total calls=3, tokens=300)
    await tracker.increment_usage(tenant_id, calls=1, tokens=50)
    assert await tracker.is_quota_exceeded(tenant_id)

    # Reset quota
    await tracker.reset(tenant_id)
    assert not await tracker.is_quota_exceeded(tenant_id)
    usage_after = await tracker.get_usage(tenant_id)
    assert usage_after["calls"] == 0
    assert usage_after["tokens"] == 0

    # Token limit breach
    await tracker.increment_usage(tenant_id, calls=1, tokens=600)
    assert await tracker.is_quota_exceeded(tenant_id)


@pytest.mark.asyncio
async def test_rag_graceful_degradation_on_quota_exceeded():
    """AI-8: When quota is exceeded, degrade to retrieval_fallback with excerpt and citations."""
    tracker = MemoryQuotaTracker()
    set_quota_tracker(tracker)
    tenant_id = "tenant_degrade_test"

    # Set quota limit to 1 call and consume it
    await tracker.set_tenant_limits(tenant_id, max_calls=1, max_tokens=1000)
    await tracker.increment_usage(tenant_id, calls=1, tokens=50)
    assert await tracker.is_quota_exceeded(tenant_id)

    provider = MockLLMProvider()
    service = RagService(llm_provider=provider, quota_tracker=tracker)

    test_chunks = [
        {
            "id": "chunk_pass_reset",
            "document_id": "doc_kb_passwords",
            "chunk_index": 0,
            "content": (
                "To reset your password, visit Settings > Security > Password Reset "
                "and click Confirm."
            ),
            "section_path": "Security > Passwords",
            "token_count": 20,
            "score": 0.95,
            "metadata": {"title": "Password Reset Guide"},
        }
    ]

    req = GenerateAnswerRequest(
        tenant_id=tenant_id,
        question="How do I reset my password?",
        retrieved_chunks=test_chunks,
    )

    response = await service.generate_answer(req)

    # Assert graceful degradation fields
    assert response.provider == "retrieval_fallback"
    assert response.quota_exceeded is True
    assert response.tokens_used == 0
    assert response.confidence == 0.70
    assert response.should_escalate is False
    assert "To reset your password, visit Settings > Security" in response.answer
    assert len(response.citations) == 1
    assert response.citations[0].chunk_id == "chunk_pass_reset"
    assert response.citations[0].title == "Password Reset Guide"


@pytest.mark.asyncio
async def test_rag_degradation_without_chunks_escalates():
    """AI-8: If quota is exceeded and no chunks exist, escalate gracefully."""
    tracker = MemoryQuotaTracker()
    set_quota_tracker(tracker)
    tenant_id = "tenant_no_chunks_degrade"

    await tracker.set_tenant_limits(tenant_id, max_calls=1)
    await tracker.increment_usage(tenant_id, calls=1)
    assert await tracker.is_quota_exceeded(tenant_id)

    provider = MockLLMProvider()
    service = RagService(llm_provider=provider, quota_tracker=tracker)

    req = GenerateAnswerRequest(
        tenant_id=tenant_id,
        question="Unanswerable question without any KB docs",
        retrieved_chunks=[],
    )

    response = await service.generate_answer(req)
    assert response.provider == "retrieval_fallback"
    assert response.quota_exceeded is True
    assert response.should_escalate is True
    assert response.confidence == 0.0


@pytest.mark.asyncio
async def test_rag_normal_generation_records_usage():
    """Verify normal RAG execution records calls and tokens in quota tracker."""
    tracker = MemoryQuotaTracker()
    set_quota_tracker(tracker)
    tenant_id = "tenant_normal_usage"

    provider = MockLLMProvider()
    service = RagService(llm_provider=provider, quota_tracker=tracker)

    test_chunks = [
        {
            "id": "c1",
            "document_id": "d1",
            "chunk_index": 0,
            "content": "Return policy allows 30 days for full refund.",
            "section_path": "Billing",
            "token_count": 12,
            "score": 0.88,
        }
    ]

    req = GenerateAnswerRequest(
        tenant_id=tenant_id,
        question="What is the refund window?",
        retrieved_chunks=test_chunks,
    )

    response = await service.generate_answer(req)
    assert response.provider == "mock"
    assert response.quota_exceeded is False
    assert response.tokens_used > 0

    usage = await tracker.get_usage(tenant_id)
    assert usage["calls"] == 1
    assert usage["tokens"] == response.tokens_used


def test_api_quota_endpoints():
    """Test GET /v1/quota/{tenant_id} and POST /v1/quota/{tenant_id}/reset endpoints."""
    client = TestClient(app)
    tenant_id = "tenant_api_quota_test"

    # Reset
    res_reset = client.post(f"/v1/quota/{tenant_id}/reset")
    assert res_reset.status_code == 200
    assert res_reset.json() == {"tenant_id": tenant_id, "status": "reset"}

    # Get quota
    res_get = client.get(f"/v1/quota/{tenant_id}")
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["tenant_id"] == tenant_id
    assert data["calls"] == 0
    assert data["tokens"] == 0
    assert data["max_calls"] == settings.daily_call_quota
    assert data["max_tokens"] == settings.daily_token_quota
    assert data["quota_exceeded"] is False
