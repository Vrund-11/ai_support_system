"""Evaluation runner executing golden sets, computing RAG metrics, and gating CI (AI-10)."""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from src.eval.repository import BaseEvalRepository, EvalRunRecord, get_eval_repository
from src.providers.base import LLMProvider
from src.providers.factory import get_llm_provider
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import ChatTurn, GenerateAnswerRequest

logger = logging.getLogger(__name__)


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(pct * len(sorted_vals))
    return round(sorted_vals[min(idx, len(sorted_vals) - 1)], 1)


@dataclass
class EvalSample:
    id: str
    question: str
    tenant_id: str = "tenant_eval_01"
    category: str = "general"
    expected_doc_ids: list[str] = field(default_factory=list)
    expected_chunk_ids: list[str] = field(default_factory=list)
    should_escalate: bool = False
    type: str = "direct"
    # Legacy compatibility fields
    expected_section: str | None = None
    expected_escalate: bool = False
    keywords: list[str] = field(default_factory=list)


@dataclass
class EvalMetrics:
    dataset_name: str
    total_samples: int
    hit_at_5: float
    groundedness: float
    escalation_f1: float
    escalation_precision: float
    escalation_recall: float
    p95_latency_ms: float
    passed_regression_gate: bool
    baseline_groundedness: float | None = None
    baseline_hit_at_5: float | None = None
    run_id: str = ""
    hit_at_1: float = 0.0
    mrr: float = 0.0
    p50_latency_ms: float = 0.0
    tokens_per_answer: float = 0.0
    embedding_latency_ms: dict[str, float] = field(default_factory=dict)
    retrieval_latency_ms: dict[str, float] = field(default_factory=dict)
    generation_latency_ms: dict[str, float] = field(default_factory=dict)
    by_type: dict[str, Any] = field(default_factory=dict)
    details: dict[str, Any] = field(default_factory=dict)


class EvalRunner:
    """Offline evaluation runner with regression gate (AI-10)."""

    def __init__(
        self,
        retriever: HybridRetriever | None = None,
        rag_service: RagService | None = None,
        llm_provider: LLMProvider | None = None,
        eval_repository: BaseEvalRepository | None = None,
    ) -> None:
        self.retriever = retriever or HybridRetriever()
        self.rag_service = rag_service or RagService()
        self.provider = llm_provider or get_llm_provider()
        self.eval_repo = eval_repository or get_eval_repository()

    @staticmethod
    def load_golden_set(filepath: str | Path) -> list[EvalSample]:
        """Load and validate JSONL golden dataset."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Golden dataset not found at {path}")

        samples: list[EvalSample] = []
        with open(path, encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                raw = line.strip()
                if not raw:
                    continue
                data = json.loads(raw)
                exp_esc = bool(data.get("should_escalate", data.get("expected_escalate", False)))
                q_type = data.get("type")
                if not q_type:
                    cat = data.get("category", "")
                    if "adversarial" in cat:
                        q_type = "adversarial"
                    elif exp_esc:
                        q_type = "unanswerable"
                    else:
                        q_type = "direct"

                samples.append(
                    EvalSample(
                        id=data.get("id", f"sample_{line_no}"),
                        tenant_id=data.get("tenant_id", "tenant_eval_01"),
                        question=data["question"],
                        category=data.get("category", q_type),
                        expected_doc_ids=data.get("expected_doc_ids", []),
                        expected_chunk_ids=data.get("expected_chunk_ids", []),
                        should_escalate=exp_esc,
                        type=q_type,
                        expected_section=data.get("expected_section"),
                        expected_escalate=exp_esc,
                        keywords=data.get("keywords", []),
                    )
                )

        if not samples:
            raise ValueError(f"Golden dataset {path} is empty")

        return samples

    async def run_evaluation(
        self,
        dataset_name: str,
        samples: list[EvalSample],
        tenant_id: str | None = None,
        enforce_gate: bool = True,
        commit_sha: str = "",
        dataset_version: str = "v2",
    ) -> EvalMetrics:
        """Run evaluation across all samples and compute detailed RAG metrics."""
        emb_latencies: list[float] = []
        ret_latencies: list[float] = []
        gen_latencies: list[float] = []
        total_latencies: list[float] = []

        hit_at_1_hits = 0
        hit_at_5_hits = 0
        reciprocal_ranks: list[float] = []
        evaluable_non_escalated = 0

        grounded_scores: list[float] = []
        total_tokens = 0

        tp = 0
        fp = 0
        tn = 0
        fn = 0

        by_type_stats: dict[str, dict[str, Any]] = {}

        for sample in samples:
            target_tenant = tenant_id or sample.tenant_id
            st_type = sample.type
            if st_type not in by_type_stats:
                by_type_stats[st_type] = {
                    "total": 0,
                    "hit_at_1": 0,
                    "hit_at_5": 0,
                    "mrr_sum": 0.0,
                    "grounded_sum": 0.0,
                    "escalated": 0,
                }
            by_type_stats[st_type]["total"] += 1

            t_total_start = time.perf_counter()

            # 1. Measure Embedding Latency
            t_emb_start = time.perf_counter()
            _ = await self.provider.get_embeddings([sample.question])
            emb_ms = (time.perf_counter() - t_emb_start) * 1000.0
            emb_latencies.append(emb_ms)

            # 2. Measure Retrieval Latency & Hit@1, Hit@5, MRR
            t_ret_start = time.perf_counter()
            top_chunks = await self.retriever.retrieve(
                tenant_id=target_tenant,
                query=sample.question,
                top_k=5,
            )
            ret_ms = (time.perf_counter() - t_ret_start) * 1000.0
            ret_latencies.append(ret_ms)

            is_evaluable = not sample.should_escalate and not sample.expected_escalate
            if is_evaluable:
                evaluable_non_escalated += 1
                first_match_rank: int | None = None

                for rank, c in enumerate(top_chunks, start=1):
                    is_match = False
                    c_slug = c.metadata.get("doc_slug", "")
                    if (
                        (
                            sample.expected_doc_ids
                            and (
                                c_slug in sample.expected_doc_ids
                                or c.document_id in sample.expected_doc_ids
                            )
                        )
                        or (sample.expected_chunk_ids and c.id in sample.expected_chunk_ids)
                        or (sample.expected_section and sample.expected_section in c.section_path)
                        or (
                            sample.keywords
                            and any(
                                kw.lower() in c.content.lower()
                                for kw in sample.keywords
                                if len(kw) > 2
                            )
                        )
                    ):
                        is_match = True

                    if is_match and first_match_rank is None:
                        first_match_rank = rank

                if first_match_rank == 1:
                    hit_at_1_hits += 1
                    by_type_stats[st_type]["hit_at_1"] += 1

                if first_match_rank is not None and first_match_rank <= 5:
                    hit_at_5_hits += 1
                    rr = 1.0 / first_match_rank
                    reciprocal_ranks.append(rr)
                    by_type_stats[st_type]["hit_at_5"] += 1
                    by_type_stats[st_type]["mrr_sum"] += rr
                else:
                    reciprocal_ranks.append(0.0)

            # 3. Measure Generation Latency
            t_gen_start = time.perf_counter()
            rag_req = GenerateAnswerRequest(
                tenant_id=target_tenant,
                question=sample.question,
                history=[ChatTurn(role="customer", content=sample.question)],
            )
            answer_resp = await self.rag_service.generate_answer(rag_req)
            gen_ms = (time.perf_counter() - t_gen_start) * 1000.0
            gen_latencies.append(gen_ms)

            total_elapsed_ms = (time.perf_counter() - t_total_start) * 1000.0
            total_latencies.append(total_elapsed_ms)

            # 4. Token estimation
            ans_text = answer_resp.answer or ""
            words = ans_text.split()
            tokens = max(1, int(len(words) * 1.33))
            total_tokens += tokens

            # 5. Sentence-Level Groundedness
            actual_esc = answer_resp.should_escalate
            if actual_esc:
                by_type_stats[st_type]["escalated"] += 1
                grounded_scores.append(1.0)
                by_type_stats[st_type]["grounded_sum"] += 1.0
            elif answer_resp.citations:
                cited_ids = {c.chunk_id for c in answer_resp.citations}
                cited_chunks = [
                    c for c in top_chunks if c.id in cited_ids or c.chunk_index in cited_ids
                ]
                if not cited_chunks:
                    cited_chunks = top_chunks[:2]

                cited_text = " ".join(c.content.lower() for c in cited_chunks)
                sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", ans_text) if s.strip()]
                if sentences:
                    supported = 0
                    for sent in sentences:
                        sent_words = [w for w in re.findall(r"\w+", sent.lower()) if len(w) > 3]
                        if not sent_words:
                            supported += 1
                        else:
                            overlap = sum(1 for w in sent_words if w in cited_text) / len(
                                sent_words
                            )
                            if overlap >= 0.40:
                                supported += 1
                    s_score = supported / len(sentences)
                    grounded_scores.append(s_score)
                    by_type_stats[st_type]["grounded_sum"] += s_score
                else:
                    grounded_scores.append(1.0)
                    by_type_stats[st_type]["grounded_sum"] += 1.0
            else:
                # Answer generated with 0 citations when chunks exist is ungrounded
                grounded_scores.append(0.0)

            # 6. Escalation Confusion Matrix
            exp_esc = sample.should_escalate or sample.expected_escalate
            if exp_esc and actual_esc:
                tp += 1
            elif not exp_esc and actual_esc:
                fp += 1
            elif not exp_esc and not actual_esc:
                tn += 1
            elif exp_esc and not actual_esc:
                fn += 1

        total = len(samples)
        hit_at_1 = (
            round(hit_at_1_hits / evaluable_non_escalated, 3)
            if evaluable_non_escalated > 0
            else 1.0
        )
        hit_at_5 = (
            round(hit_at_5_hits / evaluable_non_escalated, 3)
            if evaluable_non_escalated > 0
            else 1.0
        )
        mrr = (
            round(sum(reciprocal_ranks) / evaluable_non_escalated, 3)
            if evaluable_non_escalated > 0
            else 1.0
        )
        groundedness = round(sum(grounded_scores) / total, 3) if total > 0 else 1.0

        prec = round(tp / (tp + fp), 3) if (tp + fp) > 0 else 1.0
        rec = round(tp / (tp + fn), 3) if (tp + fn) > 0 else 1.0
        f1 = round((2 * prec * rec) / (prec + rec), 3) if (prec + rec) > 0 else 1.0

        p50_latency_ms = _percentile(total_latencies, 0.50)
        p95_latency_ms = _percentile(total_latencies, 0.95)
        tokens_per_answer = round(total_tokens / total, 1) if total > 0 else 0.0

        emb_p50 = _percentile(emb_latencies, 0.50)
        emb_p95 = _percentile(emb_latencies, 0.95)
        ret_p50 = _percentile(ret_latencies, 0.50)
        ret_p95 = _percentile(ret_latencies, 0.95)
        gen_p50 = _percentile(gen_latencies, 0.50)
        gen_p95 = _percentile(gen_latencies, 0.95)

        # 7. Regression Gate against baseline row in ai_eval_runs
        baseline = await self.eval_repo.get_latest_baseline(dataset_name)
        passed_gate = True
        baseline_groundedness = None
        baseline_hit_at_5 = None

        if baseline and enforce_gate:
            baseline_groundedness = baseline.groundedness
            baseline_hit_at_5 = baseline.hit_at_5
            if groundedness < (baseline.groundedness - 0.03):
                passed_gate = False
                logger.error(
                    "REGRESSION GATE FAILED: groundedness %.3f dropped > 0.03 from baseline %.3f",
                    groundedness,
                    baseline.groundedness,
                )
            if hit_at_5 < (baseline.hit_at_5 - 0.03):
                passed_gate = False
                logger.error(
                    "REGRESSION GATE FAILED: hit_at_5 %.3f dropped > 0.03 from baseline %.3f",
                    hit_at_5,
                    baseline.hit_at_5,
                )

        run_id = f"eval_run_{uuid.uuid4().hex[:8]}"
        record = EvalRunRecord(
            id=run_id,
            dataset_name=dataset_name,
            total_samples=total,
            hit_at_5=hit_at_5,
            groundedness=groundedness,
            escalation_f1=f1,
            escalation_precision=prec,
            escalation_recall=rec,
            p95_latency_ms=p95_latency_ms,
            passed_regression_gate=passed_gate,
            hit_at_1=hit_at_1,
            mrr=mrr,
            p50_latency_ms=p50_latency_ms,
            commit_sha=commit_sha or os.getenv("GITHUB_SHA", "local-dev"),
            embedding_model="sentence-transformers/all-MiniLM-L6-v2",
            llm_model=self.provider.name,
            dataset_version=dataset_version,
            metadata={
                "tp": tp,
                "fp": fp,
                "tn": tn,
                "fn": fn,
                "evaluable_non_escalated": evaluable_non_escalated,
                "hit_at_1": hit_at_1,
                "mrr": mrr,
                "tokens_per_answer": tokens_per_answer,
                "latencies": {
                    "embedding": {"p50": emb_p50, "p95": emb_p95},
                    "retrieval": {"p50": ret_p50, "p95": ret_p95},
                    "generation": {"p50": gen_p50, "p95": gen_p95},
                    "overall": {"p50": p50_latency_ms, "p95": p95_latency_ms},
                },
                "by_type": by_type_stats,
            },
        )

        await self.eval_repo.save_run(record)

        return EvalMetrics(
            dataset_name=dataset_name,
            total_samples=total,
            hit_at_5=hit_at_5,
            groundedness=groundedness,
            escalation_f1=f1,
            escalation_precision=prec,
            escalation_recall=rec,
            p95_latency_ms=p95_latency_ms,
            passed_regression_gate=passed_gate,
            baseline_groundedness=baseline_groundedness,
            baseline_hit_at_5=baseline_hit_at_5,
            run_id=run_id,
            hit_at_1=hit_at_1,
            mrr=mrr,
            p50_latency_ms=p50_latency_ms,
            tokens_per_answer=tokens_per_answer,
            embedding_latency_ms={"p50": emb_p50, "p95": emb_p95},
            retrieval_latency_ms={"p50": ret_p50, "p95": ret_p95},
            generation_latency_ms={"p50": gen_p50, "p95": gen_p95},
            by_type=by_type_stats,
            details=record.metadata,
        )
