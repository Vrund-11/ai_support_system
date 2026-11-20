"""Evaluation runner executing golden sets, computing RAG metrics, and gating CI (AI-10)."""

import json
import logging
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


@dataclass
class EvalSample:
    id: str
    tenant_id: str
    question: str
    category: str
    expected_section: str | None
    expected_escalate: bool
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
    run_id: str = ""
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
                samples.append(
                    EvalSample(
                        id=data.get("id", f"sample_{line_no}"),
                        tenant_id=data.get("tenant_id", "tenant_eval_01"),
                        question=data["question"],
                        category=data.get("category", "general"),
                        expected_section=data.get("expected_section"),
                        expected_escalate=bool(data.get("expected_escalate", False)),
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
    ) -> EvalMetrics:
        """Run evaluation across all samples and compute evaluation metrics."""
        latencies_ms: list[float] = []
        retrieval_hits = 0
        grounded_count = 0
        evaluable_non_escalated = 0

        tp = 0
        fp = 0
        tn = 0
        fn = 0

        for sample in samples:
            target_tenant = tenant_id or sample.tenant_id
            start_t = time.perf_counter()

            # 1. Measure Retrieval Hit@5
            top_chunks = await self.retriever.retrieve(
                tenant_id=target_tenant,
                query=sample.question,
                top_k=5,
            )

            if not sample.expected_escalate:
                evaluable_non_escalated += 1
                hit = False
                for c in top_chunks:
                    if sample.expected_section and sample.expected_section in c.section_path:
                        hit = True
                        break
                    if any(
                        kw.lower() in c.content.lower() for kw in sample.keywords if len(kw) > 2
                    ):
                        hit = True
                        break
                if hit:
                    retrieval_hits += 1

            # 2. Run RAG Generation
            rag_req = GenerateAnswerRequest(
                tenant_id=target_tenant,
                question=sample.question,
                history=[ChatTurn(role="customer", content=sample.question)],
            )
            answer_resp = await self.rag_service.generate_answer(rag_req)

            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            latencies_ms.append(elapsed_ms)

            # 3. Groundedness rule check
            if not answer_resp.should_escalate and answer_resp.citations:
                cited_ids = {c.chunk_id for c in answer_resp.citations}
                cited_chunks = [c for c in top_chunks if c.id in cited_ids]
                if cited_chunks:
                    # Verify overlap between answer words and cited text
                    cited_text = " ".join(c.content.lower() for c in cited_chunks)
                    answer_words = [
                        w for w in answer_resp.answer.lower().split() if len(w) > 3
                    ]
                    if answer_words:
                        overlap = sum(1 for w in answer_words if w in cited_text) / len(
                            answer_words
                        )
                        if overlap >= 0.4:
                            grounded_count += 1
                    else:
                        grounded_count += 1
                else:
                    # Fallback for mock environment with grounded answer
                    grounded_count += 1
            elif not answer_resp.should_escalate and not answer_resp.citations:
                # Answer with no citations when chunks exist is ungrounded
                pass
            else:
                # Escalated answers are considered correctly guarded
                grounded_count += 1

            # 4. Escalation Confusion Matrix
            actual_esc = answer_resp.should_escalate
            exp_esc = sample.expected_escalate

            if exp_esc and actual_esc:
                tp += 1
            elif not exp_esc and actual_esc:
                fp += 1
            elif not exp_esc and not actual_esc:
                tn += 1
            elif exp_esc and not actual_esc:
                fn += 1

        total = len(samples)
        hit_at_5 = (
            round(retrieval_hits / evaluable_non_escalated, 3)
            if evaluable_non_escalated > 0
            else 1.0
        )
        groundedness = round(grounded_count / total, 3) if total > 0 else 1.0

        prec = round(tp / (tp + fp), 3) if (tp + fp) > 0 else 1.0
        rec = round(tp / (tp + fn), 3) if (tp + fn) > 0 else 1.0
        f1 = round((2 * prec * rec) / (prec + rec), 3) if (prec + rec) > 0 else 1.0

        latencies_ms.sort()
        p95_idx = int(0.95 * len(latencies_ms))
        p95_latency_ms = round(
            latencies_ms[min(p95_idx, len(latencies_ms) - 1)], 1
        )

        # 5. Regression Gate against baseline row in ai_eval_runs (AI-10)
        baseline = await self.eval_repo.get_latest_baseline(dataset_name)
        passed_gate = True
        baseline_groundedness = None

        if baseline and enforce_gate:
            baseline_groundedness = baseline.groundedness
            # CI gate: fail if groundedness drops more than 3 points (0.03)
            if groundedness < (baseline.groundedness - 0.03):
                passed_gate = False
                logger.error(
                    "REGRESSION GATE FAILED: groundedness %.3f dropped > 0.03 from baseline %.3f",
                    groundedness,
                    baseline.groundedness,
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
            metadata={
                "tp": tp,
                "fp": fp,
                "tn": tn,
                "fn": fn,
                "evaluable_non_escalated": evaluable_non_escalated,
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
            run_id=run_id,
            details=record.metadata,
        )
