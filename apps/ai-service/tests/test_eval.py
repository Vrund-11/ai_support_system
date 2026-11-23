"""Tests for AI evaluation harness, golden set metrics, and regression gate (AI-10)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.cache.semantic import MemorySemanticCache, set_semantic_cache
from src.eval.repository import EvalRunRecord, MemoryEvalRepository, set_eval_repository
from src.eval.runner import EvalRunner, EvalSample
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import MemoryIngestRepository, set_ingest_repository
from src.main import app
from src.providers.mock import MockLLMProvider
from src.quota import MemoryQuotaTracker, set_quota_tracker
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever


@pytest.fixture(autouse=True)
def setup_eval_env():
    cache = MemorySemanticCache()
    set_semantic_cache(cache)
    repo = MemoryIngestRepository()
    set_ingest_repository(repo)
    eval_repo = MemoryEvalRepository()
    set_eval_repository(eval_repo)
    tracker = MemoryQuotaTracker()
    set_quota_tracker(tracker)
    yield cache, repo, eval_repo


def test_load_golden_set():
    """Verify loading and schema validation of the 100-question golden dataset."""
    golden_path = Path("tests/ai-eval/golden/supportpilot_golden.jsonl")
    if not golden_path.exists():
        # Fallback relative to repo root
        golden_path = Path("../../tests/ai-eval/golden/supportpilot_golden.jsonl")

    samples = EvalRunner.load_golden_set(golden_path)
    assert len(samples) == 100

    # Verify categories
    categories = {s.category for s in samples}
    assert "auth_security" in categories
    assert "billing" in categories
    assert "api_webhooks" in categories
    assert "chat_handoff" in categories
    assert "team_rbac" in categories
    assert "adversarial_out_of_scope" in categories

    # Verify adversarial questions expect escalation
    adv_samples = [s for s in samples if s.category == "adversarial_out_of_scope"]
    assert len(adv_samples) == 15
    for s in adv_samples:
        assert s.expected_escalate is True


@pytest.mark.asyncio
async def test_eval_runner_execution(setup_eval_env):
    """Run full evaluation on golden set and verify metric computation."""
    _, repo, eval_repo = setup_eval_env

    # 1. Ingest KB corpus for evaluation
    corpus_path = Path("tests/ai-eval/golden/kb_corpus.md")
    if not corpus_path.exists():
        corpus_path = Path("../../tests/ai-eval/golden/kb_corpus.md")

    with open(corpus_path, encoding="utf-8") as f:
        corpus_text = f.read()

    provider = MockLLMProvider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=provider)
    await pipeline.ingest_document(
        tenant_id="tenant_eval_01",
        document_id="doc_eval_kb",
        title="Official SupportPilot KB",
        raw_text=corpus_text,
    )

    # 2. Run evaluation on golden set
    golden_path = Path("tests/ai-eval/golden/supportpilot_golden.jsonl")
    if not golden_path.exists():
        golden_path = Path("../../tests/ai-eval/golden/supportpilot_golden.jsonl")

    samples = EvalRunner.load_golden_set(golden_path)
    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    rag_service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(
        retriever=retriever,
        rag_service=rag_service,
        llm_provider=provider,
        eval_repository=eval_repo,
    )

    metrics = await runner.run_evaluation(
        dataset_name="supportpilot_golden",
        samples=samples,
        tenant_id="tenant_eval_01",
        enforce_gate=True,
    )

    assert metrics.total_samples == 100
    assert metrics.hit_at_5 > 0.70
    assert metrics.groundedness > 0.80
    assert metrics.escalation_f1 > 0.70
    assert metrics.p95_latency_ms >= 0.0
    assert metrics.passed_regression_gate is True

    # Verify run stored in eval repository
    latest = await eval_repo.get_latest_baseline("supportpilot_golden")
    assert latest is not None
    assert latest.total_samples == 100
    assert latest.groundedness == metrics.groundedness


@pytest.mark.asyncio
async def test_regression_gate_fails_on_groundedness_drop(setup_eval_env):
    """Verify CI gate trips when groundedness drops more than 3 points from baseline."""
    _, _, eval_repo = setup_eval_env

    # 1. Pre-store high baseline (groundedness 0.95)
    baseline_record = EvalRunRecord(
        id="run_baseline_01",
        dataset_name="regression_test_set",
        total_samples=10,
        hit_at_5=0.90,
        groundedness=0.95,
        escalation_f1=0.90,
        escalation_precision=0.90,
        escalation_recall=0.90,
        p95_latency_ms=15.0,
        passed_regression_gate=True,
    )
    await eval_repo.save_run(baseline_record)

    # 2. Create small sample set
    samples = [
        EvalSample(
            id="s1",
            tenant_id="t1",
            question="Question needing escalation",
            category="test",
            expected_section=None,
            expected_escalate=True,
        )
    ]

    provider = MockLLMProvider()
    runner = EvalRunner(llm_provider=provider, eval_repository=eval_repo)

    # Run without chunks so groundedness drops
    metrics = await runner.run_evaluation(
        dataset_name="regression_test_set",
        samples=samples,
        tenant_id="t1",
        enforce_gate=True,
    )

    # If new groundedness drops by > 0.03, gate must fail!
    if metrics.groundedness < (0.95 - 0.03):
        assert metrics.passed_regression_gate is False
        assert metrics.baseline_groundedness == 0.95


def test_api_eval_run_endpoint(setup_eval_env):
    """Test POST /v1/eval/run FastAPI endpoint."""
    client = TestClient(app)

    golden_path = Path("tests/ai-eval/golden/supportpilot_golden.jsonl")
    if not golden_path.exists():
        golden_path = Path("../../tests/ai-eval/golden/supportpilot_golden.jsonl")

    resp = client.post(
        "/v1/eval/run",
        json={
            "dataset_name": "supportpilot_golden",
            "golden_path": str(golden_path),
            "tenant_id": "tenant_eval_01",
            "enforce_gate": False,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataset_name"] == "supportpilot_golden"
    assert data["total_samples"] == 100
    assert "hit_at_5" in data
    assert "groundedness" in data
    assert "escalation_f1" in data
    assert "p95_latency_ms" in data


@pytest.mark.asyncio
async def test_eval_runner_v2_dataset(setup_eval_env):
    """Verify loading and evaluation on the 115-row v2 golden dataset."""
    _, repo, eval_repo = setup_eval_env
    v2_path = Path("tests/ai-eval/golden/v2.jsonl")
    if not v2_path.exists():
        v2_path = Path("../../tests/ai-eval/golden/v2.jsonl")

    samples = EvalRunner.load_golden_set(v2_path)
    assert len(samples) == 115

    provider = MockLLMProvider()
    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    rag_service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(
        retriever=retriever,
        rag_service=rag_service,
        llm_provider=provider,
        eval_repository=eval_repo,
    )

    metrics = await runner.run_evaluation(
        dataset_name="v2_test",
        samples=samples[:20],
        tenant_id="tenant_eval_01",
        enforce_gate=False,
    )

    assert metrics.total_samples == 20
    assert hasattr(metrics, "hit_at_1")
    assert hasattr(metrics, "mrr")
    assert hasattr(metrics, "p50_latency_ms")
    assert hasattr(metrics, "tokens_per_answer")
    assert "embedding_latency_ms" in metrics.details or hasattr(metrics, "embedding_latency_ms")


@pytest.mark.asyncio
async def test_regression_gate_fails_on_hit_at_5_drop(setup_eval_env):
    """Verify CI gate trips when hit_at_5 drops more than 3 points (0.03) from baseline."""
    _, repo, eval_repo = setup_eval_env

    # 1. Pre-store high baseline (hit_at_5 0.95, groundedness 0.95)
    baseline_record = EvalRunRecord(
        id="run_baseline_hit5",
        dataset_name="hit5_regression_set",
        total_samples=10,
        hit_at_5=0.95,
        groundedness=0.95,
        escalation_f1=0.90,
        escalation_precision=0.90,
        escalation_recall=0.90,
        p95_latency_ms=15.0,
        passed_regression_gate=True,
    )
    await eval_repo.save_run(baseline_record)

    # 2. Run sample with no matches in repo so hit_at_5 is 0.0
    samples = [
        EvalSample(
            id="s_miss",
            tenant_id="t_empty",
            question="Random query with no chunks",
            expected_doc_ids=["non_existent_doc"],
            should_escalate=False,
        )
    ]

    provider = MockLLMProvider()
    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    rag_service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(
        retriever=retriever,
        rag_service=rag_service,
        llm_provider=provider,
        eval_repository=eval_repo,
    )

    metrics = await runner.run_evaluation(
        dataset_name="hit5_regression_set",
        samples=samples,
        tenant_id="t_empty",
        enforce_gate=True,
    )

    assert metrics.hit_at_5 < (0.95 - 0.03)
    assert metrics.passed_regression_gate is False


def test_load_ai_written_v1_dataset():
    """Verify loading and schema validation of the 60-question ai_written_v1 golden dataset."""
    golden_path = Path("tests/ai-eval/golden/ai_written_v1.jsonl")
    if not golden_path.exists():
        golden_path = Path("../../tests/ai-eval/golden/ai_written_v1.jsonl")

    samples = EvalRunner.load_golden_set(golden_path)
    assert len(samples) == 60

    # Verify categories
    types = {s.type for s in samples}
    assert "direct" in types
    assert "multi_chunk" in types
    assert "billing" in types
    assert "auth" in types
    assert "unanswerable" in types

    # Verify escalation flags
    for s in samples:
        if s.type == "unanswerable":
            assert s.should_escalate is True
        else:
            assert s.should_escalate is False
            assert len(s.expected_doc_ids) > 0


def test_skip_human_v1_dataset_if_insufficient_rows():
    """Verify human_v1.jsonl is skipped when fewer than 40 human-authored rows are present."""
    human_path = Path("tests/ai-eval/golden/human_v1.jsonl")
    if not human_path.exists():
        human_path = Path("../../tests/ai-eval/golden/human_v1.jsonl")

    rows = []
    if human_path.exists():
        with open(human_path, encoding="utf-8-sig") as f:
            rows = [line.strip() for line in f if line.strip()]

    if len(rows) < 40:
        pytest.skip(
            f"human_v1.jsonl contains {len(rows)} rows (< 40 required human rows); "
            "skipping evaluation."
        )

    samples = EvalRunner.load_golden_set(human_path)
    assert len(samples) >= 40


@pytest.mark.asyncio
async def test_groundedness_non_escalated_isolation(setup_eval_env):
    """Verify groundedness is computed over non-escalated rows without dummy 1.0 padding."""
    _, repo, eval_repo = setup_eval_env

    provider = MockLLMProvider()
    pipeline = IngestionPipeline(repository=repo, llm_provider=provider)
    await pipeline.ingest_document(
        tenant_id="t_iso",
        document_id="doc_24_invoices_tax",
        title="Invoices and VAT Tax Documentation",
        raw_text="Invoices and VAT receipts can be downloaded directly from the billing portal.",
    )

    samples = [
        # Answerable sample with KB chunk in repo -> non-escalated row
        EvalSample(
            id="s_ans",
            tenant_id="t_iso",
            question="Where is my invoice?",
            type="billing",
            expected_doc_ids=["doc_24_invoices_tax"],
            should_escalate=False,
        ),
        # Escalated sample -> should NOT be assigned 1.0 groundedness
        EvalSample(
            id="s_esc",
            tenant_id="t_iso",
            question="Give me pizza recipe",
            type="unanswerable",
            expected_doc_ids=[],
            should_escalate=True,
        ),
    ]

    retriever = HybridRetriever(repository=repo, llm_provider=provider)
    rag_service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(
        retriever=retriever,
        rag_service=rag_service,
        llm_provider=provider,
        eval_repository=eval_repo,
    )

    metrics = await runner.run_evaluation(
        dataset_name="groundedness_isolation_test",
        samples=samples,
        tenant_id="t_iso",
        enforce_gate=False,
    )

    # Total samples is 2
    assert metrics.total_samples == 2

    # Unanswerable category must NOT have 1.0 groundedness assigned
    unans_stats = metrics.by_type.get("unanswerable", {})
    assert unans_stats.get("grounded_n", 0) == 0
    assert unans_stats.get("groundedness") is None

    # Billing category had 1 non-escalated row
    billing_stats = metrics.by_type.get("billing", {})
    assert billing_stats.get("grounded_n") == 1

    # Overall groundedness must only be computed over the 1 non-escalated row
    assert metrics.details["evaluable_non_escalated_grounded"] == 1
    assert metrics.llm_judge_sample is not None
