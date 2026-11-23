#!/usr/bin/env python3
"""Run /v1/answer for 10 independent questions with real Gemini provider and evaluate with LLM Judge."""

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

from src.config import settings

# Force postgresql port 5433 for local container access
settings.database_url = "postgresql://supportpilot:supportpilot@localhost:5433/supportpilot"

from src.eval.runner import EvalRunner
from src.ingest.repository import PostgresIngestRepository
from src.providers.factory import get_llm_provider
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import GenerateAnswerRequest

QUESTIONS = [
    {
        "id": "ind_001",
        "question": "How do I add a new agent to my team?",
        "expected_doc_slug": "doc_07_seat_provisioning",
    },
    {
        "id": "ind_002",
        "question": "Can I set different business hours for weekends?",
        "expected_doc_slug": "doc_18_business_hours",
    },
    {
        "id": "ind_003",
        "question": "Where do I find my API key?",
        "expected_doc_slug": "doc_29_api_authentication",
    },
    {
        "id": "ind_004",
        "question": "How do I reset my password?",
        "expected_doc_slug": "doc_04_password_policy",
    },
    {
        "id": "ind_005",
        "question": "What happens when a ticket breaches its SLA?",
        "expected_doc_slug": "doc_20_sla_breach_alerts",
    },
    {
        "id": "ind_006",
        "question": "How do I turn on two-factor authentication?",
        "expected_doc_slug": "doc_03_mfa_totp",
    },
    {
        "id": "ind_008",
        "question": "How do I assign a ticket to someone else?",
        "expected_doc_slug": "doc_06_rbac_roles",
    },
    {
        "id": "ind_009",
        "question": "How do I create a canned reply?",
        "expected_doc_slug": "doc_14_macros_bulk_actions",
    },
    {
        "id": "ind_011",
        "question": "How long before an inactive ticket is automatically closed?",
        "expected_doc_slug": "doc_11_ticket_lifecycle",
    },
    {
        "id": "ind_012",
        "question": "How do I embed the chat widget on my website?",
        "expected_doc_slug": "doc_31_widget_sdk",
    },
]


async def main():
    print("=================================================================")
    print("SUPPORTPILOT REAL GEMINI /v1/answer & LLM-JUDGE EVALUATION")
    print("=================================================================")

    repo = PostgresIngestRepository(dsn=settings.database_url)
    retriever = HybridRetriever(repository=repo)
    provider = get_llm_provider("gemini")
    service = RagService(retriever=retriever, llm_provider=provider)
    runner = EvalRunner(rag_service=service, llm_provider=provider)

    print(f"Configured LLM Provider: {provider.name}")
    print(f"Database: {settings.database_url}")
    print(f"Total Questions to Evaluate: {len(QUESTIONS)}\n")

    live_samples = []
    judge_results = []

    # 1. Generate live answers with real Gemini provider
    print("--- STEP 1: Generating Live /v1/answer Responses with Gemini ---")
    for idx, item in enumerate(QUESTIONS, 1):
        q_id = item["id"]
        q_text = item["question"]
        print(f"[{idx}/{len(QUESTIONS)}] Generating answer for {q_id}: '{q_text}'...")

        chunks = await retriever.retrieve(tenant_id="tenant_eval_01", query=q_text, top_k=5)
        chunk_dicts = [
            {
                "id": c.id,
                "document_id": c.document_id,
                "content": c.content,
                "section_path": c.section_path,
                "token_count": c.token_count,
                "metadata": c.metadata,
            }
            for c in chunks
        ]

        req = GenerateAnswerRequest(
            tenant_id="tenant_eval_01",
            question=q_text,
            retrieved_chunks=chunk_dicts,
        )
        ans = await service.generate_answer(req)

        sample_record = {
            "sample_id": q_id,
            "question": q_text,
            "answer": ans.answer,
            "citations": [c.model_dump() for c in ans.citations],
            "confidence": ans.confidence,
            "should_escalate": ans.should_escalate,
            "provider": ans.provider,
            "tokens_used": ans.tokens_used,
            "retrieved_context": "\n\n".join([c.content for c in chunks]),
        }
        live_samples.append(sample_record)
        print(f"    -> Answer length: {len(ans.answer)} chars, Citations: {len(ans.citations)}, Escalate: {ans.should_escalate}")

        # Rate-limiting throttle to respect Gemini 15 RPM
        time.sleep(4.0)

    # 2. Run LLM Judge on each sample
    print("\n--- STEP 2: Running Gemini LLM-Judge Groundedness Evaluation ---")
    for idx, sample in enumerate(live_samples, 1):
        q_id = sample["sample_id"]
        q_text = sample["question"]
        context = sample["retrieved_context"]
        answer = sample["answer"]
        print(f"[{idx}/{len(live_samples)}] Judging groundedness for {q_id}...")

        judge_eval = await runner.evaluate_llm_judge_sample(
            question=q_text,
            context=context,
            answer=answer,
        )
        judge_record = {
            "sample_id": q_id,
            "question": q_text,
            "status": judge_eval.get("status"),
            "verdict": "GROUNDED" if judge_eval.get("grounded") else "UNGROUNDED",
            "grounded": judge_eval.get("grounded"),
            "score": judge_eval.get("score"),
            "reasoning": judge_eval.get("reasoning"),
            "unsupported_claims": judge_eval.get("unsupported_claims", []),
        }
        if judge_eval.get("status") != "success":
            judge_record["error_details"] = judge_eval.get("error_details") or judge_eval.get("reason")
        judge_results.append(judge_record)
        print(f"    -> Status: {judge_record['status']}, Verdict: {judge_record['verdict']}, Score: {judge_record['score']}")

        # Rate-limiting throttle to respect Gemini 15 RPM
        time.sleep(4.0)

    # 3. Aggregate statistics
    successful = [j for j in judge_results if j.get("status") == "success"]
    failed = [j for j in judge_results if j.get("status") != "success"]
    grounded_count = sum(1 for j in successful if j.get("grounded") is True)
    mean_groundedness = (
        sum(j["score"] for j in successful if j.get("score") is not None) / len(successful)
        if successful
        else 0.0
    )

    print("\n" + "=" * 80)
    print("LLM JUDGE EVALUATION RESULTS SUMMARY")
    print("=" * 80)
    print(f"Total Evaluated Samples (n): {len(judge_results)}")
    print(f"Successful Evaluations:      {len(successful)}")
    print(f"Failed / Quota 429s:         {len(failed)}")
    print(f"Fully Grounded Samples:      {grounded_count}/{len(successful)}")
    print(f"Aggregate Mean Groundedness: {mean_groundedness:.4f} (over successful samples, n={len(successful)})")
    print("=" * 80)

    print("\n| Sample ID | Verdict | Score | Question | Reasoning |")
    print("|---|---|---|---|---|")
    for j in judge_results:
        q_disp = j["question"][:35].replace("|", "\\|")
        r_disp = (j.get("reasoning") or j.get("error_details") or "")[:60].replace("|", "\\|")
        print(f"| `{j['sample_id']}` | **{j['verdict']}** | `{j.get('score')}` | {q_disp}... | {r_disp}... |")

    # 4. Save JSON evidence files
    out_dir = REPO_ROOT / "evidence" / "reaudit5"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save live samples (without huge raw context in json to keep clean)
    clean_live_samples = []
    for s in live_samples:
        clean_s = {k: v for k, v in s.items() if k != "retrieved_context"}
        clean_live_samples.append(clean_s)

    live_samples_path = out_dir / "05-gemini-live-samples.json"
    live_samples_path.write_text(json.dumps(clean_live_samples, indent=2), encoding="utf-8")
    print(f"\nSaved raw live samples to: {live_samples_path}")

    judge_results_path = out_dir / "05-gemini-judge-results.json"
    judge_payload = {
        "metadata": {
            "eval_timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "llm_provider": "gemini",
            "model": "gemini-3.5-flash-lite",
            "sample_count": len(judge_results),
            "successful_count": len(successful),
            "failed_count": len(failed),
            "aggregate_mean_groundedness": round(mean_groundedness, 4),
        },
        "results": judge_results,
    }
    judge_results_path.write_text(json.dumps(judge_payload, indent=2), encoding="utf-8")
    print(f"Saved raw judge results to: {judge_results_path}")


if __name__ == "__main__":
    asyncio.run(main())
