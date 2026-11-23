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
    llm_judge_sample: dict[str, Any] | None = None
    llm_judge_results: list[dict[str, Any]] = field(default_factory=list)
    gate_failures: list[str] = field(default_factory=list)


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

    async def evaluate_llm_judge_sample(
        self,
        question: str,
        context: str,
        answer: str,
    ) -> dict[str, Any]:
        """Evaluate groundedness of a sample answer using Gemini LLM-judge.

        Gracefully handles missing or invalid GEMINI_API_KEY with clear logging.
        """
        api_key = os.getenv("GEMINI_API_KEY") or getattr(self.provider, "api_key", None)
        if not api_key:
            logger.info("LLM-judge evaluation skipped: GEMINI_API_KEY is not set.")
            return {
                "status": "skipped",
                "reason": "GEMINI_API_KEY environment variable not set",
                "score": None,
                "grounded": None,
                "feedback": "Evaluation skipped due to missing API key.",
            }

        prompt = (
            "You are an impartial AI evaluator. Evaluate whether the provided Answer is "
            "strictly grounded in the Reference Context. Every factual claim in the Answer must "
            "be supported by the Context.\n\n"
            f"Question: {question}\n\n"
            f"Reference Context: {context}\n\n"
            f"Answer: {answer}\n\n"
            "Respond in JSON format with keys:\n"
            "- 'grounded': boolean (true if all claims supported, false otherwise)\n"
            "- 'score': float between 0.0 and 1.0 representing percentage of grounded claims\n"
            "- 'reasoning': short explanation of your judgment\n"
            "- 'unsupported_claims': list of strings containing unsupported claims "
            "(empty if fully grounded)\n"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.0},
        }

        try:
            import httpx

            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 404:
                    # Fallback to gemini-3.8-flash if flash-lite is unavailable
                    fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
                    resp = await client.post(fallback_url, json=payload)
                if resp.status_code != 200:
                    logger.warning(
                        "LLM-judge request failed with status %d: %s. Gracefully proceeding.",
                        resp.status_code,
                        resp.text[:200],
                    )
                    return {
                        "status": "failed",
                        "status_code": resp.status_code,
                        "reason": f"Gemini API returned HTTP {resp.status_code}",
                        "error_details": resp.text[:200],
                        "score": None,
                        "grounded": None,
                    }
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                parsed = json.loads(raw_text.strip())
                logger.info(
                    "LLM-judge evaluation succeeded: grounded=%s, score=%s",
                    parsed.get("grounded"),
                    parsed.get("score"),
                )
                return {
                    "status": "success",
                    "grounded": parsed.get("grounded"),
                    "score": parsed.get("score"),
                    "reasoning": parsed.get("reasoning"),
                    "unsupported_claims": parsed.get("unsupported_claims", []),
                }
        except Exception as exc:
            logger.warning(
                "LLM-judge evaluation encountered exception: %s. Gracefully proceeding.", exc
            )
            return {
                "status": "error",
                "reason": str(exc),
                "score": None,
                "grounded": None,
            }

    @staticmethod
    def load_golden_set(filepath: str | Path) -> list[EvalSample]:
        """Load and validate JSONL golden dataset."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Golden dataset not found at {path}")

        samples: list[EvalSample] = []
        with open(path, encoding="utf-8-sig") as f:
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
                        expected_doc_ids=(
                            data.get("expected_doc_ids") or data.get("expected_doc_slugs", [])
                        ),
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
        max_judge_samples: int = 0,
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
        llm_judge_sample: dict[str, Any] | None = None
        llm_judge_results: list[dict[str, Any]] = []

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
                    "grounded_count": 0,
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
            # CRITICAL (R4): Groundedness is strictly calculated over non-escalated rows.
            # Never assign 1.0 to escalated rows!
            actual_esc = answer_resp.should_escalate
            exp_esc = sample.should_escalate or sample.expected_escalate
            is_non_escalated = (not actual_esc) and (not exp_esc)

            if is_non_escalated:
                if answer_resp.citations:
                    cited_ids = {c.chunk_id for c in answer_resp.citations}
                    cited_chunks = [
                        c for c in top_chunks if c.id in cited_ids or c.chunk_index in cited_ids
                    ]
                    if not cited_chunks:
                        cited_chunks = top_chunks[:2]

                    cited_text = " ".join(c.content.lower() for c in cited_chunks)
                    raw_sents = re.split(r"(?<=[.!?])\s+", ans_text)
                    sentences = [s.strip() for s in raw_sents if s.strip()]
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
                    else:
                        s_score = 1.0

                    # Run samples through LLM-judge (up to max_judge_samples)
                    if len(llm_judge_results) < max_judge_samples:
                        try:
                            judge_entry = await self.evaluate_llm_judge_sample(
                                question=sample.question,
                                context=cited_text,
                                answer=ans_text,
                            )
                            judge_entry["sample_id"] = sample.id
                            judge_entry["question"] = sample.question
                            llm_judge_results.append(judge_entry)
                            if llm_judge_sample is None:
                                llm_judge_sample = judge_entry
                        except Exception as judge_exc:
                            logger.warning("LLM-judge call error: %s", judge_exc)
                            err_entry = {
                                "status": "error",
                                "reason": str(judge_exc),
                                "sample_id": sample.id,
                                "question": sample.question,
                            }
                            llm_judge_results.append(err_entry)
                            if llm_judge_sample is None:
                                llm_judge_sample = err_entry
                else:
                    # Answer generated with 0 citations when non-escalated is ungrounded
                    s_score = 0.0

                grounded_scores.append(s_score)
                by_type_stats[st_type]["grounded_sum"] += s_score
                by_type_stats[st_type]["grounded_count"] += 1
            else:
                if actual_esc:
                    by_type_stats[st_type]["escalated"] += 1

            # 6. Escalation Confusion Matrix
            if exp_esc and actual_esc:
                tp += 1
            elif not exp_esc and actual_esc:
                fp += 1
            elif not exp_esc and not actual_esc:
                tn += 1
            elif exp_esc and not actual_esc:
                fn += 1

        if llm_judge_sample is None:
            llm_judge_sample = {
                "status": "skipped",
                "reason": "No non-escalated row with citations evaluated",
            }

        # Calculate category groundedness and counts
        for _q_type, stats in by_type_stats.items():
            g_cnt = stats.get("grounded_count", 0)
            stats["grounded_n"] = g_cnt
            if g_cnt > 0:
                stats["groundedness"] = round(stats["grounded_sum"] / g_cnt, 3)
            else:
                stats["groundedness"] = None

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
        groundedness = (
            round(sum(grounded_scores) / len(grounded_scores), 3)
            if grounded_scores
            else 1.0
        )

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

        # 7. Regression Gate against benchmarks & baseline
        gate_failures = []
        if hit_at_1 < 0.700:
            gate_failures.append(f"Hit@1 ({hit_at_1:.3f} < 0.700)")
        if hit_at_5 < 0.850:
            gate_failures.append(f"Hit@5 ({hit_at_5:.3f} < 0.850)")
        if mrr < 0.750:
            gate_failures.append(f"MRR ({mrr:.3f} < 0.750)")
        if prec < 0.800:
            gate_failures.append(f"Escalation Precision ({prec:.3f} < 0.800)")
        if rec < 0.800:
            gate_failures.append(f"Escalation Recall ({rec:.3f} < 0.800)")
        if f1 < 0.800:
            gate_failures.append(f"Escalation F1 ({f1:.3f} < 0.800)")

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
                    "REGRESSION GATE FAILED: groundedness %.3f dropped > 0.03 from baseline "
                    f"{baseline.groundedness:.3f}"
                )
            if hit_at_5 < (baseline.hit_at_5 - 0.03):
                passed_gate = False
                logger.error(
                    f"REGRESSION GATE FAILED: hit_at_5 {hit_at_5:.3f} dropped > 0.03 from baseline "
                    f"{baseline.hit_at_5:.3f}"
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
                "evaluable_non_escalated_grounded": len(grounded_scores),
                "hit_at_1": hit_at_1,
                "mrr": mrr,
                "tokens_per_answer": tokens_per_answer,
                "llm_judge_sample": llm_judge_sample,
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
            llm_judge_sample=llm_judge_sample,
            llm_judge_results=llm_judge_results,
            gate_failures=gate_failures,
        )
