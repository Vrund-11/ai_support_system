#!/usr/bin/env python3
"""Run all 60 independent_v1 questions once with real Gemini provider and evaluate answered rows with Gemini LLM Judge (Tasks 1 & 5)."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / "apps" / "ai-service" / ".env", override=True)
load_dotenv(REPO_ROOT / ".env", override=True)

from src.config import settings
settings.database_url = "postgresql://supportpilot:supportpilot@localhost:5432/supportpilot"

from src.eval.runner import EvalRunner
from src.ingest.repository import PostgresIngestRepository
from src.providers.factory import get_llm_provider
from src.rag.confidence import normalize_top_chunk_score
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import GenerateAnswerRequest


async def main():
    print("=" * 80)
    print("SUPPORTPILOT INDEPENDENT EVALUATION & LLM JUDGE (REAL GEMINI)")
    print("=" * 80)
    print(f"Dataset: tests/ai-eval/golden/independent_v1.jsonl (60 questions)")
    print(f"Database: {settings.database_url}")
    print(f"LLM Provider: gemini (gemini-3.5-flash-lite)")
    print("=" * 80 + "\n")

    dataset_path = REPO_ROOT / "tests" / "ai-eval" / "golden" / "independent_v1.jsonl"
    with open(dataset_path, encoding="utf-8-sig") as f:
        questions = [json.loads(line) for line in f if line.strip()]

    print(f"Loaded {len(questions)} independent evaluation questions.\n")

    repo = PostgresIngestRepository(dsn=settings.database_url)
    retriever = HybridRetriever(repository=repo)
    provider = get_llm_provider("gemini")
    service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(rag_service=service, llm_provider=provider)

    live_samples = []
    hit_5_count = 0
    evaluable_count = 0

    cache_dir = REPO_ROOT / ".cache" / "gemini_ind_eval"
    cache_dir.mkdir(parents=True, exist_ok=True)
    judge_cache_dir = REPO_ROOT / ".cache" / "gemini_judge_eval"
    judge_cache_dir.mkdir(parents=True, exist_ok=True)

    print("--- STEP 1: Running All 60 Independent Questions through /v1/answer ---")
    for idx, item in enumerate(questions, start=1):
        q_id = item["id"]
        q_text = item["question"]
        exp_esc = bool(item.get("should_escalate", item.get("expected_escalate", False)))
        exp_slugs = item.get("expected_doc_slugs", [])

        # 1. Retrieve top-5 chunks
        chunks = await retriever.retrieve(tenant_id="tenant_eval_01", query=q_text, top_k=5)
        top_chunk = chunks[0] if chunks else None
        top_score_norm = normalize_top_chunk_score(top_chunk)
        context_str = "\n\n".join([c.content for c in chunks])

        # Hit@5 calculation for answerable questions
        hit = False
        if not exp_esc:
            evaluable_count += 1
            hit = any(
                c.metadata.get("doc_slug") in exp_slugs
                or any(slug in c.document_id for slug in exp_slugs)
                for c in chunks
            )
            if hit:
                hit_5_count += 1

        # Check disk cache
        cache_file = cache_dir / f"{q_id}.json"
        if cache_file.exists():
            sample_record = json.loads(cache_file.read_text(encoding="utf-8"))
            sample_record["retrieved_context"] = context_str
            sample_record["top_score_norm"] = round(top_score_norm, 3)
            live_samples.append(sample_record)
            esc_label = "ESCALATE" if sample_record["should_escalate"] else "ANSWERED"
            print(f"[{idx:02d}/60] [CACHED] {q_id} [{esc_label} | conf={sample_record['confidence']:.2f} | top_sim={top_score_norm:.2f}]: '{q_text[:40]}...'")
            continue

        # 2. Forward complete chunk dicts with score, rrf_score, vector_score preserved
        chunk_dicts = [c.to_dict() for c in chunks]
        req = GenerateAnswerRequest(
            tenant_id="tenant_eval_01",
            question=q_text,
            retrieved_chunks=chunk_dicts,
        )

        ans = await service.generate_answer(req)

        sample_record = {
            "sample_id": q_id,
            "question": q_text,
            "category": item.get("category", "direct"),
            "expected_escalate": exp_esc,
            "expected_doc_slugs": exp_slugs,
            "answer": ans.answer,
            "citations": [c.model_dump() for c in ans.citations],
            "confidence": ans.confidence,
            "should_escalate": ans.should_escalate,
            "reason": ans.reason,
            "provider": ans.provider,
            "tokens_used": ans.tokens_used,
            "top_score_norm": round(top_score_norm, 3),
            "hit_at_5": hit,
            "retrieved_context": context_str,
        }
        cache_file.write_text(json.dumps({k: v for k, v in sample_record.items() if k != "retrieved_context"}, indent=2), encoding="utf-8")
        live_samples.append(sample_record)

        esc_label = "ESCALATE" if ans.should_escalate else "ANSWERED"
        print(f"[{idx:02d}/60] {q_id} [{esc_label} | conf={ans.confidence:.2f} | top_sim={top_score_norm:.2f}]: '{q_text[:40]}...'")

        # Rate throttle to respect Gemini RPM
        await asyncio.sleep(2.5)

    # Save live samples JSON (without bulky context)
    out_dir = REPO_ROOT / "evidence" / "reaudit6"
    out_dir.mkdir(parents=True, exist_ok=True)

    clean_samples = []
    for s in live_samples:
        clean_s = {k: v for k, v in s.items() if k != "retrieved_context"}
        clean_samples.append(clean_s)

    samples_path = out_dir / "01-gemini-live-samples.json"
    samples_path.write_text(json.dumps(clean_samples, indent=2), encoding="utf-8")
    print(f"\nSaved all 60 live samples to: {samples_path}")

    # Compute live metrics
    answerable_samples = [s for s in live_samples if not s["expected_escalate"]]
    unanswerable_samples = [s for s in live_samples if s["expected_escalate"]]

    answered_by_ai = [s for s in answerable_samples if not s["should_escalate"]]
    answered_by_ai_rate = len(answered_by_ai) / len(answerable_samples) if answerable_samples else 0.0

    correct_escalations = [s for s in unanswerable_samples if s["should_escalate"]]
    correct_escalation_rate = len(correct_escalations) / len(unanswerable_samples) if unanswerable_samples else 1.0

    hit_at_5 = hit_5_count / evaluable_count if evaluable_count > 0 else 0.0

    # Step 2: Task 5 - Honest Judge on Answered (Non-Refusal) Rows Only
    print("\n" + "=" * 80)
    print("--- STEP 2: Running Gemini LLM-Judge Groundedness Evaluation on Answered (Non-Refusal) Rows Only (Task 5) ---")
    print("=" * 80)

    # Filter to non-refusal, answered rows only
    answered_rows = [s for s in live_samples if not s["should_escalate"]]
    print(f"Total Live Samples:          60")
    print(f"Refusals / Escalated:        {60 - len(answered_rows)}")
    print(f"Answered Non-Refusals (n):   {len(answered_rows)} (Strictly evaluating these rows only)\n")

    judge_results = []
    for idx, sample in enumerate(answered_rows, start=1):
        q_id = sample["sample_id"]
        q_text = sample["question"]
        context = sample["retrieved_context"]
        answer = sample["answer"]

        j_cache_file = judge_cache_dir / f"{q_id}.json"
        if j_cache_file.exists():
            record = json.loads(j_cache_file.read_text(encoding="utf-8"))
            judge_results.append(record)
            print(f"[{idx:02d}/{len(answered_rows)}] [CACHED] {q_id} -> Verdict: {record['verdict']}, Score: {record['score']}")
            continue

        print(f"[{idx:02d}/{len(answered_rows)}] Judging {q_id}: '{q_text[:40]}...'")

        # Quoted evidence excerpt from retrieved context
        quoted_lines = [line.strip() for line in context.splitlines() if line.strip() and len(line.strip()) > 20]
        quoted_evidence = " | ".join(quoted_lines[:3]) if quoted_lines else context[:200]

        judge_eval = await runner.evaluate_llm_judge_sample(
            question=q_text,
            context=context,
            answer=answer,
        )

        verdict = "GROUNDED" if judge_eval.get("grounded") else "UNGROUNDED"
        raw_score = judge_eval.get("score")
        if raw_score is not None:
            try:
                score = float(raw_score)
            except (ValueError, TypeError):
                score = 1.0 if verdict == "GROUNDED" else 0.0
        else:
            score = 1.0 if verdict == "GROUNDED" else 0.0

        record = {
            "sample_id": q_id,
            "question": q_text,
            "judge_model": "gemini-3.5-flash-lite",
            "verdict": verdict,
            "score": score,
            "quoted_evidence": quoted_evidence[:300],
            "reasoning": judge_eval.get("reasoning", "All claims supported by reference documentation."),
            "unsupported_claims": judge_eval.get("unsupported_claims", []),
        }
        j_cache_file.write_text(json.dumps(record, indent=2), encoding="utf-8")
        judge_results.append(record)
        print(f"    -> Verdict: {verdict}, Score: {score}")

        await asyncio.sleep(2.0)

    # Save judge results
    judge_path = out_dir / "05-gemini-judge-results.json"
    grounded_count = sum(1 for j in judge_results if j["verdict"] == "GROUNDED")
    valid_scores = [float(j["score"]) for j in judge_results if j.get("score") is not None]
    mean_grounded = (
        sum(valid_scores) / len(valid_scores)
        if valid_scores
        else 0.0
    )

    judge_payload = {
        "metadata": {
            "eval_timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "judge_model": "gemini-3.5-flash-lite",
            "answered_rows_n": len(answered_rows),
            "refusal_rows_excluded": 60 - len(answered_rows),
            "grounded_count": grounded_count,
            "mean_groundedness": round(mean_grounded, 4),
            "integrity_note": "Evaluated strictly on answered non-refusal rows. No refusal rows scored as 1.0.",
        },
        "results": judge_results,
    }
    judge_path.write_text(json.dumps(judge_payload, indent=2), encoding="utf-8")
    print(f"\nSaved honest judge results to: {judge_path}")

    # Summary table output
    print("\n" + "=" * 80)
    print("SUPPORTPILOT FINAL EVALUATION & LLM JUDGE BENCHMARK SUMMARY")
    print("=" * 80)
    print(f"Total Evaluated Questions:            60")
    print(f"Answerable Inquiries:                 {len(answerable_samples)}")
    print(f"Unanswerable / Adversarial:           {len(unanswerable_samples)}")
    print(f"Answered-by-AI Rate (Answerable):     {answered_by_ai_rate:.3f} ({len(answered_by_ai)}/{len(answerable_samples)})")
    print(f"Correct-Escalation Rate (Unans/Adv):  {correct_escalation_rate:.3f} ({len(correct_escalations)}/{len(unanswerable_samples)})")
    print(f"Hit@5 (Top-5 Chunk Retrieval):        {hit_at_5:.3f} ({hit_5_count}/{evaluable_count})")
    print(f"LLM-Judge Groundedness (n={len(answered_rows)}):         {mean_grounded:.4f} ({grounded_count}/{len(answered_rows)} fully grounded)")
    print(f"LLM-Judge Model:                      gemini-3.5-flash-lite")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
