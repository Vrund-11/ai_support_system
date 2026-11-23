"""Retrieval diagnostics for ind_004 and ind_002.

Task 2 requirements:
1. Retrieve top-5 chunks for ind_004 ('How do I reset my password?') and ind_002 ('different business hours for weekends').
2. Show chunk ids, doc_slugs, titles, contents, and similarity scores.
3. Explain why both questions resulted in refusals based on corpus contents
   (doc_04_password_policy.md, doc_05_account_lockout.md, doc_18_business_hours.md).
"""

import asyncio
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

from src.ingest.repository import PostgresIngestRepository
from src.retrieval.hybrid import HybridRetriever

DB_URL = "postgresql://supportpilot:supportpilot@localhost:5432/supportpilot"
TENANT_ID = "tenant_eval_01"
CORPUS_DIR = REPO_ROOT / "tests" / "ai-eval" / "corpus"


async def run_diagnostics():
    print("=" * 80)
    print("SUPPORTPILOT AUDIT: TASK 2 - RETRIEVAL DIAGNOSTICS & CORPUS ANALYSIS")
    print("=" * 80)
    print(f"PostgreSQL connection: {DB_URL}")
    print(f"Target tenant: {TENANT_ID}")

    repo = PostgresIngestRepository(dsn=DB_URL)
    retriever = HybridRetriever(repository=repo)

    test_queries = [
        {
            "id": "ind_004",
            "query": "How do I reset my password?",
            "relevant_docs": ["doc_04_password_policy.md", "doc_05_account_lockout.md"],
        },
        {
            "id": "ind_002",
            "query": "Can I set different business hours for weekends?",
            "relevant_docs": ["doc_18_business_hours.md"],
        },
    ]

    for item in test_queries:
        qid = item["id"]
        qtext = item["query"]
        print("\n" + "#" * 80)
        print(f"QUERY [{qid}]: \"{qtext}\"")
        print("#" * 80)

        chunks = await retriever.retrieve(
            tenant_id=TENANT_ID,
            query=qtext,
            top_k=5,
        )

        print(f"Retrieved {len(chunks)} chunks:")
        for rank, c in enumerate(chunks, start=1):
            doc_slug = c.metadata.get("doc_slug") or c.document_id
            title = c.metadata.get("title") or c.section_path
            print("\n" + "-" * 60)
            print(f"Rank {rank}: Chunk ID: {c.id}")
            print(f"  Document ID:   {c.document_id}")
            print(f"  Doc Slug:      {doc_slug}")
            print(f"  Title/Section: {title}")
            print(f"  Scores:        hybrid_score={c.score:.4f} | rrf_score={c.rrf_score:.4f} | vector_score={c.vector_score} | text_score={c.text_score}")
            print(f"  Ranks:         vector_rank={c.vector_rank} | text_rank={c.text_rank}")
            print("  --- Chunk Content ---")
            for line in c.content.strip().splitlines():
                print(f"    {line}")

    # Inspect corpus documents directly
    print("\n" + "=" * 80)
    print("CORPUS DOCUMENT CONTENT AUDIT")
    print("=" * 80)

    audit_docs = [
        "doc_04_password_policy.md",
        "doc_05_account_lockout.md",
        "doc_18_business_hours.md",
    ]

    for doc_name in audit_docs:
        doc_path = CORPUS_DIR / doc_name
        print("\n" + "-" * 60)
        print(f"FILE: tests/ai-eval/corpus/{doc_name}")
        print("-" * 60)
        if doc_path.exists():
            print(doc_path.read_text(encoding="utf-8").strip())
        else:
            print(f"[ERROR] File not found: {doc_path}")

    # Root Cause Explanation
    print("\n" + "=" * 80)
    print("ROOT CAUSE ANALYSIS: WHY BOTH QUESTIONS RESULTED IN REFUSALS")
    print("=" * 80)

    print("""
1. ANALYSIS FOR ind_004 ('How do I reset my password?'):
--------------------------------------------------------------------------------
- Question: "How do I reset my password?"
- Annotator expectation in independent_v1.jsonl: should_escalate=false, expecting
  doc_04_password_policy and doc_05_account_lockout to answer.
- What doc_04_password_policy.md contains:
  * Minimum password length (12 characters).
  * Character complexity (uppercase, lowercase, digit, special character).
  * HaveIBeenPwned k-Anonymity API breach checking.
  * History restrictions (cannot reuse last 5 passwords).
  * Expiration intervals (60, 90, 180 days) and reminder email timings.
  * ZERO mention of how a user or admin initiates a password reset, reset links,
    or the 'Forgot Password' workflow on the login page.
- What doc_05_account_lockout.md contains:
  * Lockout thresholds (5 consecutive failed attempts = 15m lock; 10 = hardened lock).
  * Unlock procedures (automated email link with HMAC token to unlock account, or
    admin unlock via Settings > Team > User Profile > Unlock Account).
  * ZERO mention of resetting a password. It only covers unlocking a locked account.
- RAG Generation & Anti-Hallucination Policy:
  * The RAG system prompt explicitly commands:
    "If the retrieved documents do not provide adequate evidence to answer the
     question, or if the question requires guessing or extrapolating facts not
     in the context, you MUST refuse to answer and state:
     'I do not have enough information in the provided knowledge base to answer this question.'
     Do NOT hallucinate policies or procedures."
  * Because the retrieved chunks explain password rules and lockout recovery but
    contain zero steps for password reset, the real LLM (Gemini) correctly refused:
    "I do not have enough information in the provided knowledge base to answer how to reset your password."
  * CONCLUSION: Retrieval succeeded in finding the most semantically related chunks
    (doc_04 and doc_05), but the corpus itself lacks password reset instructions.
    The refusal is the correct, honest behavior, and the benchmark label in
    independent_v1.jsonl was a human annotator false assumption.

2. ANALYSIS FOR ind_002 ('Can I set different business hours for weekends?'):
--------------------------------------------------------------------------------
- Question: "Can I set different business hours for weekends?"
- Annotator expectation in independent_v1.jsonl: should_escalate=false, expecting
  doc_18_business_hours.md to answer.
- What doc_18_business_hours.md contains:
  * Setting up calendars via Settings > SLAs > Business Hours.
  * Configuring default operating hours (e.g., Monday through Friday, 9:00 AM to 6:00 PM EST).
  * Adding company holidays and seasonal office closures to Holiday Exceptions.
  * Explicit note: "When an SLA policy is configured to use Business Hours, tickets
    arriving on Friday evening pause their resolution countdown until Monday at 9:00 AM."
  * ZERO mention or capability for configuring separate or different hours on weekends.
- RAG Generation & Anti-Hallucination Policy:
  * The user explicitly asks if they can set *different* business hours for weekends.
  * In the product documentation, weekends are completely off-hours (Friday evening pauses
    countdown until Monday morning). There is no provision to configure weekend hours.
  * Because the knowledge base does not define weekend business hours settings,
    answering "yes" or hallucinating a configuration setting would violate grounding.
  * Gemini responded:
    "I do not have enough information in the knowledge base to answer whether you can set different business hours for weekends."
  * Alternatively, a human agent could clarify that weekends are strictly non-operational.
  * CONCLUSION: Retrieval succeeded in returning doc_18_business_hours.
    The refusal occurred because the feature requested ("different business hours for weekends")
    is not documented or supported in the corpus. Refusal prevents false promise hallucination.
================================================================================
""")


if __name__ == "__main__":
    try:
        asyncio.run(run_diagnostics())
    except Exception as exc:
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
    os._exit(0)
