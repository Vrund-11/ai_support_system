"""Tests for RAG answer generation, JSON repair, citation verification,
and confidence (AI-1, 2, 3, 9).
"""

import pytest
from fastapi.testclient import TestClient

from src.ingest.repository import MemoryIngestRepository, set_ingest_repository
from src.main import app
from src.providers.mock import MockLLMProvider
from src.rag.confidence import (
    compute_composite_confidence,
    normalize_top_chunk_score,
)
from src.rag.prompt import build_system_prompt, build_user_prompt
from src.rag.service import RagService
from src.rag.validator import generate_json_with_repair, verify_citations
from src.retrieval.hybrid import HybridRetriever, SearchResultChunk
from src.schemas.llm import ChatTurn, CitationItem, GenerateAnswerRequest, RagAnswer


@pytest.fixture(autouse=True)
def setup_memory_repo():
    repo = MemoryIngestRepository()
    set_ingest_repository(repo)
    yield repo


def test_rag_prompt_builder():
    """Verify prompt builder sets tenant tone, rules, bounded history, and chunk context."""
    system_prompt = build_system_prompt(tenant_tone="empathetic, polite, and technical")
    assert "empathetic, polite, and technical" in system_prompt
    assert "Strict Rules" in system_prompt
    assert "Prompt Injection Defense" in system_prompt

    chunk = SearchResultChunk(
        id="chunk-abc-1",
        document_id="doc-xyz-1",
        chunk_index=0,
        content="Billing cycle resets on the 1st of each month.",
        section_path="Billing > Cycle",
        token_count=10,
        score=0.9,
        rrf_score=0.03,
    )

    history = [
        ChatTurn(role="customer", content="Hi there"),
        ChatTurn(role="agent", content="Hello! How can I help?"),
        ChatTurn(role="customer", content="When does billing reset?"),
    ]

    user_prompt = build_user_prompt(
        question="When does billing reset?",
        history=history,
        chunks=[chunk],
        max_history_turns=2,  # Bounded to 2
    )

    assert "[chunk:chunk-abc-1]" in user_prompt
    assert "(doc: doc-xyz-1, section: Billing > Cycle)" in user_prompt
    assert "Billing cycle resets on the 1st" in user_prompt
    # First message should be truncated due to max_history_turns=2
    assert "Hi there" not in user_prompt
    assert "Customer Question: When does billing reset?" in user_prompt


def test_confidence_formula():
    """Verify formula: 0.5*top_score_norm + 0.3*citation_coverage + 0.2*self_rating."""
    # Example: top_score = 0.8, citation_coverage = 1.0, self_rating = 0.9
    # Expected: 0.5*(0.8) + 0.3*(1.0) + 0.2*(0.9) = 0.40 + 0.30 + 0.18 = 0.88
    conf = compute_composite_confidence(
        top_score_norm=0.8,
        citation_coverage=1.0,
        self_rating=0.9,
    )
    assert conf == 0.88

    # Edge case: no chunks retrieved, no citations, low self rating
    low_conf = compute_composite_confidence(
        top_score_norm=0.0,
        citation_coverage=0.0,
        self_rating=0.4,
    )
    assert low_conf == 0.08


def test_top_chunk_score_normalization():
    """Test chunk score normalization from vector and RRF scores."""
    assert normalize_top_chunk_score(None) == 0.0

    chunk_vector = SearchResultChunk(
        id="c1",
        document_id="d1",
        chunk_index=0,
        content="test",
        section_path="",
        token_count=5,
        score=0.85,
        rrf_score=0.03,
        vector_score=0.85,
    )
    assert normalize_top_chunk_score(chunk_vector) == 0.85

    # RRF only
    max_rrf = 2.0 / 61.0
    chunk_rrf = SearchResultChunk(
        id="c2",
        document_id="d1",
        chunk_index=1,
        content="test",
        section_path="",
        token_count=5,
        score=max_rrf,
        rrf_score=max_rrf,
        vector_score=None,
    )
    assert pytest.approx(normalize_top_chunk_score(chunk_rrf), rel=1e-3) == 1.0

    # Tuned RRF with k=20, vector_weight=1.0, text_weight=0.7 (max_rrf = 1.7 / 21)
    tuned_max_rrf = 1.7 / 21.0
    chunk_tuned_rrf = SearchResultChunk(
        id="c3",
        document_id="d1",
        chunk_index=2,
        content="tuned",
        section_path="",
        token_count=5,
        score=tuned_max_rrf,
        rrf_score=tuned_max_rrf,
        vector_score=None,
    )
    assert pytest.approx(normalize_top_chunk_score(chunk_tuned_rrf), rel=1e-3) == 1.0


@pytest.mark.asyncio
async def test_chunk_to_dict_and_retrieval_score_forwarding():
    """Verify chunk dictionary conversion preserves score, rrf_score, and vector_score."""
    chunk = SearchResultChunk(
        id="chunk-test-1",
        document_id="doc-test-1",
        chunk_index=0,
        content="Content for retrieval forwarding test.",
        section_path="Section > Sub",
        token_count=12,
        score=0.82,
        rrf_score=0.045,
        vector_rank=1,
        text_rank=2,
        vector_score=0.82,
        text_score=0.75,
        metadata={"title": "Test Doc"},
    )
    chunk_dict = chunk.to_dict()
    assert chunk_dict["id"] == "chunk-test-1"
    assert chunk_dict["score"] == 0.82
    assert chunk_dict["rrf_score"] == 0.045
    assert chunk_dict["vector_score"] == 0.82

    # Forward through GenerateAnswerRequest and service
    service = RagService(llm_provider=MockLLMProvider())
    req = GenerateAnswerRequest(
        tenant_id="tenant-test",
        question="What is the content?",
        retrieved_chunks=[chunk_dict],
    )
    reconstructed = await service._retrieve_chunks(req)
    assert len(reconstructed) == 1
    rec_chunk = reconstructed[0]
    assert rec_chunk.score == 0.82
    assert rec_chunk.rrf_score == 0.045
    assert rec_chunk.vector_score == 0.82
    assert rec_chunk.text_score == 0.75
    assert normalize_top_chunk_score(rec_chunk) == 0.82


def test_citation_verification_grounding():
    """Verify ungrounded chunk citations trigger violation (T-AI-02)."""
    retrieved_chunk = SearchResultChunk(
        id="chunk-valid-101",
        document_id="doc-1",
        chunk_index=0,
        content="Reset steps...",
        section_path="",
        token_count=5,
        score=0.9,
        rrf_score=0.03,
    )

    # 1. Valid citation
    valid_citation = CitationItem(
        chunk_id="chunk-valid-101",
        doc_id="doc-1",
        title="Guide",
    )
    is_valid, err = verify_citations([valid_citation], [retrieved_chunk])
    assert is_valid is True
    assert err is None

    # 2. Hallucinated / ungrounded chunk id (T-AI-02)
    fake_citation = CitationItem(
        chunk_id="chunk-fake-999",
        doc_id="doc-1",
        title="Hallucinated Doc",
    )
    is_valid, err = verify_citations([fake_citation], [retrieved_chunk])
    assert is_valid is False
    assert "Ungrounded citation" in err
    assert "chunk-fake-999" in err


@pytest.mark.asyncio
async def test_json_repair_retry_success():
    """Verify 1-shot repair retry recovers when first attempt returns malformed JSON."""
    provider = MockLLMProvider()
    provider.simulate_malformed_json = True
    provider.simulate_repair_failure = False

    result, attempts = await generate_json_with_repair(
        provider=provider,
        system_prompt="Test system",
        user_prompt="Answer query",
        schema=RagAnswer,
    )

    assert attempts == 2
    assert result.answer is not None
    assert isinstance(result, RagAnswer)


@pytest.mark.asyncio
async def test_json_repair_retry_failure_escalates():
    """Verify persistent JSON failure escalates to human agent cleanly."""
    provider = MockLLMProvider()
    provider.simulate_malformed_json = True
    provider.simulate_repair_failure = True

    retriever = HybridRetriever(llm_provider=provider)
    service = RagService(retriever=retriever, llm_provider=provider)

    req = GenerateAnswerRequest(
        tenant_id="tenant-fail",
        question="How to configure webhooks?",
    )

    response = await service.generate_answer(req)
    assert response.should_escalate is True
    assert "JSON validation failed after repair retry" in response.reason
    assert "Connecting you with a human support agent" in response.answer


@pytest.mark.asyncio
async def test_ungrounded_citation_triggers_escalation(setup_memory_repo):
    """Test that citing a chunk not in retrieved context triggers escalation (T-AI-02)."""
    repo = setup_memory_repo
    provider = MockLLMProvider()

    # Configure provider to cite a fake chunk
    provider.custom_citations = [
        CitationItem(
            chunk_id="chunk-hallucinated-xyz",
            doc_id="doc-unknown",
            title="Fake Guide",
        )
    ]

    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    service = RagService(retriever=retriever, llm_provider=provider)

    req = GenerateAnswerRequest(
        tenant_id="tenant-test",
        question="What is the refund period?",
    )

    response = await service.generate_answer(req)
    assert response.should_escalate is True
    assert "Ungrounded citation" in response.reason


@pytest.mark.asyncio
async def test_low_confidence_threshold_triggers_escalation(setup_memory_repo):
    """Test that answers below confidence threshold escalate to human agent."""
    repo = setup_memory_repo
    provider = MockLLMProvider()
    provider.simulate_low_confidence = True
    provider.custom_citations = [CitationItem(chunk_id="chunk-c1", doc_id="doc-1", title="Guide")]

    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    service = RagService(retriever=retriever, llm_provider=provider)

    req = GenerateAnswerRequest(
        tenant_id="tenant-test",
        question="Obscure question with low context match",
        retrieved_chunks=[
            {
                "id": "chunk-c1",
                "document_id": "doc-1",
                "chunk_index": 0,
                "content": "Short matching context",
                "score": 0.4,
                "vector_score": 0.4,
            }
        ],
        confidence_threshold=0.85,  # High threshold
    )

    response = await service.generate_answer(req)
    assert response.should_escalate is True
    assert "below threshold" in response.reason


def test_api_answer_endpoint(setup_memory_repo):
    """Test POST /v1/answer FastAPI endpoint end to end."""
    client = TestClient(app)

    # 1. Ingest document
    ingest_resp = client.post(
        "/v1/kb/ingest",
        json={
            "tenant_id": "api-tenant",
            "document_id": "doc-sla-01",
            "title": "SLA Policy",
            "text": "Enterprise tickets must receive an initial response within 15 minutes.",
        },
    )
    assert ingest_resp.status_code == 200

    # 2. Get chunk ID from ingested doc
    chunks_resp = client.get("/v1/kb/documents/doc-sla-01/chunks?tenant_id=api-tenant")
    assert chunks_resp.status_code == 200

    # 3. Call answer endpoint
    answer_resp = client.post(
        "/v1/answer",
        json={
            "tenant_id": "api-tenant",
            "question": "What is the response time for enterprise tickets?",
            "retrieved_chunks": [
                {
                    "id": "doc-sla-01_0",
                    "document_id": "doc-sla-01",
                    "chunk_index": 0,
                    "content": (
                        "Enterprise tickets must receive an initial response within 15 minutes."
                    ),
                    "score": 0.95,
                    "vector_score": 0.95,
                }
            ],
        },
    )
    assert answer_resp.status_code == 200
    data = answer_resp.json()
    assert "answer" in data
    assert "confidence" in data
    assert "should_escalate" in data
    assert data["provider"] == "mock"


@pytest.mark.asyncio
async def test_conversational_greetings_no_escalation(setup_memory_repo):
    """Test that general greetings and pleasantries return directly without ticket escalation."""
    repo = setup_memory_repo
    provider = MockLLMProvider()
    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    service = RagService(retriever=retriever, llm_provider=provider)

    for greeting in ["hi", "hello!", "hey there", "good morning", "thanks", "who are you", "help"]:
        req = GenerateAnswerRequest(
            tenant_id="tenant-test",
            question=greeting,
        )
        res = await service.generate_answer(req)
        assert res.should_escalate is False
        assert res.confidence == 1.0
        assert res.citations == []
        assert res.provider == "conversational"
        assert res.tokens_used == 0
        assert len(res.answer) > 0
