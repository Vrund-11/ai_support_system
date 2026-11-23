#!/usr/bin/env python3
"""Run AI Service Evaluation and Retrieval Ablation Studies (Milestone 3 / R4).

Usage:
    python scripts/run_eval_and_ablation.py --eval
    python scripts/run_eval_and_ablation.py --ablation
    python scripts/run_eval_and_ablation.py --all
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# Ensure apps/ai-service is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

from src.embeddings import MockProvider, SbertProvider
from src.eval.repository import MemoryEvalRepository
from src.eval.runner import EvalMetrics, EvalRunner, EvalSample
from src.ingest.chunker import DocumentChunker
from src.ingest.extract import clean_text
from src.ingest.repository import (
    BaseIngestRepository,
    MemoryIngestRepository,
)
from src.providers.mock import MockLLMProvider
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever


def extract_title(content: str, default: str) -> str:
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return default


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(pct * len(sorted_vals))
    return round(sorted_vals[min(idx, len(sorted_vals) - 1)], 1)


async def ingest_corpus(
    corpus_dir: Path,
    tenant_id: str,
    repo: BaseIngestRepository,
    embedding_provider,
) -> int:
    """Ingest markdown files from corpus into target repository."""
    files = sorted(corpus_dir.glob("*.md"))
    if not files:
        print(f"Warning: No markdown files found in {corpus_dir}")
        return 0

    chunker = DocumentChunker(target_tokens=500, overlap_tokens=80)
    total_chunks = 0

    for file in files:
        raw_text = file.read_text(encoding="utf-8")
        cleaned = clean_text(raw_text)
        title = extract_title(raw_text, file.stem)
        doc_slug = file.stem
        doc_uuid = f"doc_{doc_slug}"

        await repo.upsert_document(
            tenant_id=tenant_id,
            document_id=doc_uuid,
            title=title,
            source=f"corpus/{file.name}",
            status="PROCESSING",
        )

        chunks = chunker.chunk_document(cleaned)
        for c in chunks:
            c.metadata["doc_slug"] = doc_slug
            c.metadata["embedding_model"] = getattr(
                embedding_provider, "model_name", "sentence-transformers/all-MiniLM-L6-v2"
            )

        texts = [c.content for c in chunks]
        embeddings = embedding_provider.embed(texts)

        await repo.save_chunks_transaction(
            tenant_id=tenant_id,
            document_id=doc_uuid,
            chunks=chunks,
            embeddings=embeddings,
        )
        total_chunks += len(chunks)

    return total_chunks


async def run_evaluation(
    dataset_path: Path,
    corpus_dir: Path,
    tenant_id: str,
    dataset_name: str,
) -> EvalMetrics:
    print("\n=======================================================")
    print(f"EVALUATION: {dataset_name} ({dataset_path})")
    print("=======================================================")

    repo = MemoryIngestRepository()
    eval_repo = MemoryEvalRepository()
    sbert_provider = SbertProvider()

    print(f"Ingesting corpus from {corpus_dir} with real SBERT embeddings...")
    t0 = time.perf_counter()
    chunk_count = await ingest_corpus(corpus_dir, tenant_id, repo, sbert_provider)
    print(f"Ingested {chunk_count} chunks in {time.perf_counter() - t0:.2f}s.")

    samples = EvalRunner.load_golden_set(dataset_path)
    print(f"Loaded {len(samples)} evaluation samples.")

    # Wrap SbertProvider for HybridRetriever and RagService
    class SbertLLMWrapper(MockLLMProvider):
        name = "mock"

        def __init__(self, sbert: SbertProvider):
            super().__init__(embedding_dim=384)
            self.sbert = sbert

        async def get_embeddings(self, texts: list[str]) -> list[list[float]]:
            return await self.sbert.aembed(texts)

    provider_wrap = SbertLLMWrapper(sbert_provider)
    retriever = HybridRetriever(repository=repo, embedding_provider=sbert_provider)
    rag_service = RagService(retriever=retriever, llm_provider=provider_wrap)

    runner = EvalRunner(
        retriever=retriever,
        rag_service=rag_service,
        llm_provider=provider_wrap,
        eval_repository=eval_repo,
    )

    t_start = time.perf_counter()
    metrics = await runner.run_evaluation(
        dataset_name=dataset_name,
        samples=samples,
        tenant_id=tenant_id,
        enforce_gate=False,
    )
    elapsed = time.perf_counter() - t_start

    embedding_provider_name = "sbert"
    llm_provider_name = provider_wrap.name
    is_mock = "mock" in llm_provider_name.lower()
    groundedness_label = (
        "Lexical overlap (mock generator)"
        if is_mock
        else "Groundedness"
    )

    print(f"\nEvaluation completed in {elapsed:.2f}s.")
    print(f"- Embedding Provider: {embedding_provider_name} (sentence-transformers/all-MiniLM-L6-v2)")
    print(f"- LLM Generation Provider: {llm_provider_name} (MockLLMProvider)")
    print(f"- Total Samples: {metrics.total_samples}")
    print(f"- Hit@1: {metrics.hit_at_1:.3f}")
    print(f"- Hit@5: {metrics.hit_at_5:.3f}")
    print(f"- MRR: {metrics.mrr:.3f}")
    print(f"- {groundedness_label} (non-escalated strictly isolated): {metrics.groundedness:.3f}")
    print(f"- Escalation Precision: {metrics.escalation_precision:.3f}")
    print(f"- Escalation Recall: {metrics.escalation_recall:.3f}")
    print(f"- Escalation F1: {metrics.escalation_f1:.3f}")
    print(f"- Latency p50: {metrics.p50_latency_ms:.1f}ms | p95: {metrics.p95_latency_ms:.1f}ms")

    print("\n--- Performance by Category ---")
    print(f"{'Category':<20} | {'Total':<6} | {'Hit@1':<8} | {'Hit@5':<8} | {groundedness_label + ' (n)':<35}")
    print("-" * 88)
    for q_type, stats in metrics.by_type.items():
        cnt = stats.get("total", 0)
        h1 = stats.get("hit_at_1", 0)
        h5 = stats.get("hit_at_5", 0)
        g_cnt = stats.get("grounded_count", stats.get("grounded_n", 0))
        g_sum = stats.get("grounded_sum", 0.0)

        h1_str = f"{h1/cnt:.3f}" if cnt > 0 and q_type not in ("unanswerable", "adversarial") else "N/A"
        h5_str = f"{h5/cnt:.3f}" if cnt > 0 and q_type not in ("unanswerable", "adversarial") else "N/A"
        if g_cnt > 0:
            g_str = f"{g_sum/g_cnt:.3f} (n={g_cnt})"
        else:
            g_str = "N/A (Escalated, n=0)"
        print(f"{q_type:<20} | {cnt:<6} | {h1_str:<8} | {h5_str:<8} | {g_str:<35}")

    llm_sample = metrics.llm_judge_sample
    print("\n--- LLM-Judge Groundedness Sample ---")
    if llm_sample:
        print(f"Status: {llm_sample.get('status')}")
        if llm_sample.get("grounded") is not None:
            print(f"Grounded: {llm_sample.get('grounded')}")
        if llm_sample.get("score") is not None:
            print(f"Score: {llm_sample.get('score')}")
        if llm_sample.get("reasoning"):
            print(f"Reasoning: {llm_sample.get('reasoning')}")
        if llm_sample.get("reason"):
            print(f"Note: {llm_sample.get('reason')}")
        if llm_sample.get("status_code"):
            print(f"Status Code: {llm_sample.get('status_code')}")
    else:
        print("None recorded.")

    return metrics


@dataclass
class AblationResult:
    mode_name: str
    hit_at_1: float
    hit_at_5: float
    mrr: float
    p50_retrieval_ms: float
    p95_retrieval_ms: float
    notes: str


async def evaluate_ablation_mode(
    repo: BaseIngestRepository,
    embedding_provider,
    samples: list[EvalSample],
    tenant_id: str,
    mode: str,
    mode_label: str,
    notes: str,
) -> AblationResult:
    retriever = HybridRetriever(repository=repo, embedding_provider=embedding_provider)
    latencies: list[float] = []
    hit_1 = 0
    hit_5 = 0
    reciprocal_ranks: list[float] = []
    evaluable = 0

    for sample in samples:
        if sample.should_escalate or sample.expected_escalate:
            continue

        evaluable += 1
        t_start = time.perf_counter()
        top_chunks = await retriever.retrieve(
            tenant_id=tenant_id,
            query=sample.question,
            top_k=5,
            mode=mode,
        )
        lat_ms = (time.perf_counter() - t_start) * 1000.0
        latencies.append(lat_ms)

        first_rank = None
        for rank, c in enumerate(top_chunks, start=1):
            c_slug = c.metadata.get("doc_slug", "")
            is_match = False
            if sample.expected_doc_ids and (
                c_slug in sample.expected_doc_ids or c.document_id in sample.expected_doc_ids
            ) or sample.expected_chunk_ids and c.id in sample.expected_chunk_ids:
                is_match = True

            if is_match and first_rank is None:
                first_rank = rank

        if first_rank == 1:
            hit_1 += 1
        if first_rank is not None and first_rank <= 5:
            hit_5 += 1
            reciprocal_ranks.append(1.0 / first_rank)
        else:
            reciprocal_ranks.append(0.0)

    h1 = round(hit_1 / evaluable, 3) if evaluable > 0 else 0.0
    h5 = round(hit_5 / evaluable, 3) if evaluable > 0 else 0.0
    mrr = round(sum(reciprocal_ranks) / evaluable, 3) if evaluable > 0 else 0.0
    p50 = _percentile(latencies, 0.50)
    p95 = _percentile(latencies, 0.95)

    return AblationResult(
        mode_name=mode_label,
        hit_at_1=h1,
        hit_at_5=h5,
        mrr=mrr,
        p50_retrieval_ms=p50,
        p95_retrieval_ms=p95,
        notes=notes,
    )


async def run_ablation_study(
    dataset_path: Path,
    corpus_dir: Path,
) -> list[AblationResult]:
    print("\n=======================================================")
    print(f"RETRIEVAL ABLATION STUDY: {dataset_path.name}")
    print("=======================================================")

    samples = EvalRunner.load_golden_set(dataset_path)
    evaluable = [s for s in samples if not s.should_escalate and not s.expected_escalate]
    print(f"Loaded {len(samples)} total samples ({len(evaluable)} evaluable non-escalated questions).")

    tenant_sbert = "tenant_ablation_sbert"
    tenant_mock = "tenant_ablation_mock"

    repo_sbert = MemoryIngestRepository()
    repo_mock = MemoryIngestRepository()

    sbert_provider = SbertProvider()
    print("Ingesting corpus with real SBERT (sentence-transformers/all-MiniLM-L6-v2)...")
    await ingest_corpus(corpus_dir, tenant_sbert, repo_sbert, sbert_provider)

    mock_provider = MockProvider(dim=384)
    print("Ingesting corpus with MockProvider (SHA-256 pseudo-vectors)...")
    await ingest_corpus(corpus_dir, tenant_mock, repo_mock, mock_provider)

    configs = [
        (
            repo_sbert,
            sbert_provider,
            tenant_sbert,
            "vector_only",
            "dense_only",
            "Dense vector search using SBERT all-MiniLM-L6-v2 (384d cosine similarity).",
        ),
        (
            repo_sbert,
            sbert_provider,
            tenant_sbert,
            "text_only",
            "sparse_only",
            "Lexical keyword token search (BM25 / tsvector token matching).",
        ),
        (
            repo_sbert,
            sbert_provider,
            tenant_sbert,
            "hybrid",
            "hybrid_no_rerank",
            "Reciprocal Rank Fusion (RRF k=60) combining dense vector and lexical lists.",
        ),
        (
            repo_sbert,
            sbert_provider,
            tenant_sbert,
            "hybrid_rerank",
            "hybrid_rerank",
            "Hybrid RRF followed by candidate lexical section and phrase reranker.",
        ),
        (
            repo_mock,
            mock_provider,
            tenant_mock,
            "hybrid",
            "mock_baseline",
            "Deterministic hash pseudo-vectors baseline showing failure of simulated metrics.",
        ),
    ]

    results: list[AblationResult] = []
    print("\nRunning ablation configurations...")
    for repo, provider, tenant, mode, label, notes in configs:
        print(f"Evaluating ablation configuration: {label}...")
        res = await evaluate_ablation_mode(
            repo=repo,
            embedding_provider=provider,
            samples=samples,
            tenant_id=tenant,
            mode=mode,
            mode_label=label,
            notes=notes,
        )
        results.append(res)
        print(f"  -> Hit@1: {res.hit_at_1:.3f} | Hit@5: {res.hit_at_5:.3f} | MRR: {res.mrr:.3f} | p50: {res.p50_retrieval_ms:.1f}ms")

    print("\n==========================================================================================")
    print("RETRIEVAL ABLATION RESULTS SUMMARY")
    print("==========================================================================================")
    print(f"{'Ablation Label':<20} | {'Hit@1':<8} | {'Hit@5':<8} | {'MRR':<8} | {'p50 (ms)':<10} | {'p95 (ms)':<10} | Notes")
    print("-" * 110)
    for r in results:
        print(f"{r.mode_name:<20} | {r.hit_at_1:<8.3f} | {r.hit_at_5:<8.3f} | {r.mrr:<8.3f} | {r.p50_retrieval_ms:<10.1f} | {r.p95_retrieval_ms:<10.1f} | {r.notes}")

    return results


async def main_async():
    parser = argparse.ArgumentParser(description="SupportPilot Evaluation and Ablation Runner")
    parser.add_argument("--eval", action="store_true", help="Run full evaluation")
    parser.add_argument("--ablation", action="store_true", help="Run retrieval ablation study")
    parser.add_argument("--all", action="store_true", help="Run both evaluation and ablation")
    parser.add_argument("--dataset", type=str, default=None, help="Target evaluation dataset path")
    args = parser.parse_args()

    if not args.eval and not args.ablation and not args.all:
        args.eval = True
        args.ablation = True

    corpus_dir = REPO_ROOT / "tests" / "ai-eval" / "corpus"
    v2_path = REPO_ROOT / "tests" / "ai-eval" / "golden" / "v2.jsonl"
    ai_written_path = REPO_ROOT / "tests" / "ai-eval" / "golden" / "ai_written_v1.jsonl"
    human_path = REPO_ROOT / "tests" / "ai-eval" / "golden" / "human_v1.jsonl"

    utc_start = datetime.datetime.now(datetime.UTC).isoformat()
    print(f"Run started at: {utc_start}")
    print(f"Python executable: {sys.executable}")
    print(f"Repository root: {REPO_ROOT}")

    if args.dataset:
        target_path = Path(args.dataset)
        if not target_path.is_absolute():
            target_path = REPO_ROOT / target_path
        if not target_path.exists():
            print(f"Error: dataset {target_path} does not exist.")
            sys.exit(1)

        if args.eval or args.all:
            await run_evaluation(
                dataset_path=target_path,
                corpus_dir=corpus_dir,
                tenant_id=f"tenant_eval_{target_path.stem}",
                dataset_name=target_path.stem,
            )
        if args.ablation or args.all:
            await run_ablation_study(
                dataset_path=target_path,
                corpus_dir=corpus_dir,
            )
    else:
        if args.eval or args.all:
            await run_evaluation(
                dataset_path=v2_path,
                corpus_dir=corpus_dir,
                tenant_id="tenant_eval_v2",
                dataset_name="golden_v2_synthetic_115",
            )
            if ai_written_path.exists():
                await run_evaluation(
                    dataset_path=ai_written_path,
                    corpus_dir=corpus_dir,
                    tenant_id="tenant_eval_ai_written_v1",
                    dataset_name="ai_written_v1_60_AI_written",
                )
            if human_path.exists():
                with open(human_path, encoding="utf-8-sig") as f:
                    h_rows = [line.strip() for line in f if line.strip()]
                if len(h_rows) >= 40:
                    await run_evaluation(
                        dataset_path=human_path,
                        corpus_dir=corpus_dir,
                        tenant_id="tenant_eval_human_v1",
                        dataset_name="human_v1_curated_60",
                    )
                else:
                    print(
                        f"\n[SKIP] human_v1.jsonl contains {len(h_rows)} rows (< 40 human rows required). "
                        "Skipping evaluation; human to provide."
                    )
            else:
                print("\n[SKIP] human_v1.jsonl not found. Skipping evaluation; human to provide.")

        if args.ablation or args.all:
            await run_ablation_study(
                dataset_path=v2_path,
                corpus_dir=corpus_dir,
            )

    utc_end = datetime.datetime.now(datetime.UTC).isoformat()
    print(f"\nRun completed at: {utc_end}")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
