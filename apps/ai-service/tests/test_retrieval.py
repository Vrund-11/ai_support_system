"""Tests for hybrid retrieval with RRF and cross-tenant isolation (AI-1)."""

import pytest
from fastapi.testclient import TestClient

from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import MemoryIngestRepository, StoredChunk, set_ingest_repository
from src.main import app
from src.providers.factory import get_llm_provider
from src.retrieval.hybrid import HybridRetriever


@pytest.fixture(autouse=True)
def setup_memory_repo():
    """Use fresh MemoryIngestRepository for each test."""
    repo = MemoryIngestRepository()
    set_ingest_repository(repo)
    yield repo


def test_rrf_scoring_arithmetic():
    """Verify reciprocal rank fusion formula: sum(1 / (k + rank))."""
    chunk_a = StoredChunk(
        id="c1",
        tenant_id="t1",
        document_id="d1",
        chunk_index=0,
        content="Document A",
        section_path="",
        token_count=10,
        embedding=[0.1] * 384,
        metadata={},
    )
    chunk_b = StoredChunk(
        id="c2",
        tenant_id="t1",
        document_id="d1",
        chunk_index=1,
        content="Document B",
        section_path="",
        token_count=10,
        embedding=[0.2] * 384,
        metadata={},
    )

    # Chunk A: rank 1 vector, rank 2 text
    # Chunk B: rank 2 vector, rank 1 text
    vector_results = [(chunk_a, 0.95), (chunk_b, 0.85)]
    text_results = [(chunk_b, 1.5), (chunk_a, 0.5)]

    fused = HybridRetriever.compute_rrf(vector_results, text_results, k=60)
    assert len(fused) == 2

    # Score: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.0163934 + 0.0161290 = 0.0325224
    expected_score = (1.0 / 61.0) + (1.0 / 62.0)
    assert pytest.approx(fused[0].rrf_score, rel=1e-4) == expected_score
    assert pytest.approx(fused[1].rrf_score, rel=1e-4) == expected_score

    # Check rank tracking
    res_a = next(r for r in fused if r.id == "c1")
    assert res_a.vector_rank == 1
    assert res_a.text_rank == 2
    assert res_a.vector_score == 0.95
    assert res_a.text_score == 0.5


def test_rrf_single_system_match():
    """Verify doc present in only vector or text search gets single reciprocal score."""
    chunk_v = StoredChunk(
        id="cv",
        tenant_id="t1",
        document_id="d1",
        chunk_index=0,
        content="Vector only",
        section_path="",
        token_count=10,
        embedding=[0.1] * 384,
        metadata={},
    )
    chunk_t = StoredChunk(
        id="ct",
        tenant_id="t1",
        document_id="d1",
        chunk_index=1,
        content="Text only",
        section_path="",
        token_count=10,
        embedding=[0.2] * 384,
        metadata={},
    )

    vector_results = [(chunk_v, 0.9)]
    text_results = [(chunk_t, 2.0)]

    fused = HybridRetriever.compute_rrf(vector_results, text_results, k=60)
    assert len(fused) == 2

    # Both at rank 1 in their respective systems
    assert pytest.approx(fused[0].rrf_score, rel=1e-4) == 1.0 / 61.0
    assert pytest.approx(fused[1].rrf_score, rel=1e-4) == 1.0 / 61.0


@pytest.mark.asyncio
async def test_tenant_isolation_in_vector_and_text_retrieval(setup_memory_repo):
    """CRITICAL: Queries for Tenant B must NEVER return Tenant A data under any circumstances."""
    repo = setup_memory_repo
    provider = get_llm_provider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=provider)

    # Ingest confidential data into tenant-alpha
    await pipeline.ingest_document(
        tenant_id="tenant-alpha",
        document_id="doc-alpha-001",
        title="Alpha Enterprise Secrets",
        raw_text=(
            "The confidential admin password is secret-token-xyz-123. "
            "Enterprise customers receive unconditional 100% full refund."
        ),
    )

    # Ingest public data into tenant-beta
    await pipeline.ingest_document(
        tenant_id="tenant-beta",
        document_id="doc-beta-001",
        title="Beta Standard Guide",
        raw_text=(
            "Welcome to Beta portal. We offer basic community support. "
            "Subscriptions are billed monthly."
        ),
    )

    retriever = HybridRetriever(repository=repo, llm_provider=provider)

    # 1. Tenant Beta searches for Alpha's secret keyword and exact phrase
    beta_results = await retriever.retrieve(
        tenant_id="tenant-beta",
        query="unconditional 100% full refund secret-token-xyz-123",
        top_k=5,
    )

    # Cross-tenant check: Zero results or only tenant-beta results!
    for result in beta_results:
        assert "tenant-alpha" not in result.id, (
            "SECURITY BREACH: Tenant A chunk leaked to Tenant B!"
        )
        assert "secret-token-xyz" not in result.content, (
            "SECURITY BREACH: Tenant A content leaked to Tenant B!"
        )

    # 2. Tenant Alpha searches for their own data
    alpha_results = await retriever.retrieve(
        tenant_id="tenant-alpha",
        query="unconditional full refund admin password",
        top_k=5,
    )
    assert len(alpha_results) > 0
    assert "secret-token-xyz" in alpha_results[0].content
    assert alpha_results[0].document_id == "doc-alpha-001"


@pytest.mark.asyncio
async def test_hybrid_retrieval_combines_semantic_and_keyword(setup_memory_repo):
    """Verify hybrid search ranks items matching both semantic and keyword higher."""
    repo = setup_memory_repo
    provider = get_llm_provider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=provider)

    text = """# SupportPilot KB
## SLA Policy
Critical tickets must be responded to within fifteen minutes.

## Escalation Paths
If an agent is unavailable, the ticket escalates to team lead automatically.

## Pricing Plans
Starter plan costs 29 dollars monthly and includes five agent seats.
"""

    await pipeline.ingest_document(
        tenant_id="tenant-test",
        document_id="doc-test-01",
        title="Knowledge Base",
        raw_text=text,
    )

    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    results = await retriever.retrieve(
        tenant_id="tenant-test",
        query="SLA policy fifteen minutes response",
        top_k=3,
    )

    assert len(results) > 0
    top_chunk = results[0]
    assert "fifteen minutes" in top_chunk.content or "SLA Policy" in top_chunk.section_path
    assert top_chunk.rrf_score > 0.0


def test_api_retrieval_endpoint(setup_memory_repo):
    """Test POST /v1/retrieval/search HTTP endpoint."""
    client = TestClient(app)

    # First ingest via API
    ingest_resp = client.post(
        "/v1/kb/ingest",
        json={
            "tenant_id": "api-tenant",
            "document_id": "doc-api-01",
            "title": "API Policy Guide",
            "text": (
                "All API endpoints require Bearer authentication. "
                "Rate limits are 60 requests per minute."
            ),
        },
    )
    assert ingest_resp.status_code == 200

    # Search via API
    search_resp = client.post(
        "/v1/retrieval/search",
        json={
            "tenant_id": "api-tenant",
            "query": "Bearer authentication rate limits",
            "top_k": 3,
        },
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["tenant_id"] == "api-tenant"
    assert data["count"] > 0
    assert len(data["results"]) > 0
    first = data["results"][0]
    assert "id" in first
    assert "document_id" in first
    assert "content" in first
    assert "rrf_score" in first
    assert "Bearer authentication" in first["content"]


def test_api_retrieval_cross_tenant_isolation(setup_memory_repo):
    """Test API endpoint strictly rejects returning data to wrong tenant."""
    client = TestClient(app)

    # Ingest for Tenant X
    client.post(
        "/v1/kb/ingest",
        json={
            "tenant_id": "tenant-x",
            "document_id": "doc-x-01",
            "title": "Confidential X",
            "text": "Tenant X proprietary billing secret-code-9988.",
        },
    )

    # Search as Tenant Y
    resp = client.post(
        "/v1/retrieval/search",
        json={
            "tenant_id": "tenant-y",
            "query": "proprietary billing secret-code-9988",
            "top_k": 5,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert len(data["results"]) == 0
