"""Clean stale data from kb_documents and kb_chunks for tenant_eval_01.

Task 3 requirements:
1. Query kb_documents and kb_chunks for tenant_id='tenant_eval_01' documents not in tests/ai-eval/corpus/
   (specifically the 8 seeded rows with source='seed' including 'REST API and Webhooks' UUID 2cd4a90e-4c8b-59eb-9cd6-2accc05970da).
2. Show counts before.
3. Delete stale rows.
4. Re-ingest the 55 documents via scripts/ingest_corpus.py.
5. Verify exactly 55 documents remain for tenant_eval_01.
"""

import asyncio
import os
import sys
from pathlib import Path

# Insert ai-service to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

import psycopg
from scripts.ingest_corpus import ingest_corpus

DB_URL = "postgresql://supportpilot:supportpilot@localhost:5432/supportpilot"
TENANT_ID = "tenant_eval_01"
CORPUS_DIR = REPO_ROOT / "tests" / "ai-eval" / "corpus"


def main():
    print("=" * 80)
    print("SUPPORTPILOT AUDIT: TASK 3 - CLEAN STALE KNOWLEDGE BASE DATA")
    print("=" * 80)
    print(f"Connecting to PostgreSQL: {DB_URL}")
    print(f"Target tenant: {TENANT_ID}")
    print(f"Corpus directory: {CORPUS_DIR}")

    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # 1. Inspect counts before
            cur.execute("SELECT COUNT(*) FROM kb_documents WHERE tenant_id = %s;", (TENANT_ID,))
            doc_count_before = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM kb_chunks WHERE tenant_id = %s;", (TENANT_ID,))
            chunk_count_before = cur.fetchone()[0]

            print("\n--- BEFORE CLEANUP ---")
            print(f"Total kb_documents for '{TENANT_ID}': {doc_count_before}")
            print(f"Total kb_chunks for '{TENANT_ID}': {chunk_count_before}")

            # 2. Query stale non-corpus documents (source = 'seed' or not like 'corpus/%')
            cur.execute(
                """
                SELECT id, title, source, created_at
                FROM kb_documents
                WHERE tenant_id = %s AND source NOT LIKE 'corpus/%%'
                ORDER BY created_at ASC;
                """,
                (TENANT_ID,),
            )
            stale_docs = cur.fetchall()

            print(f"\nDiscovered {len(stale_docs)} stale non-corpus document(s) in '{TENANT_ID}':")
            stale_doc_ids = []
            for doc_id, title, source, created_at in stale_docs:
                stale_doc_ids.append(doc_id)
                cur.execute(
                    "SELECT COUNT(*) FROM kb_chunks WHERE tenant_id = %s AND document_id = %s;",
                    (TENANT_ID, doc_id),
                )
                chunk_cnt = cur.fetchone()[0]
                print(f"  - UUID: {doc_id} | Source: {source} | Chunks: {chunk_cnt:2d} | Title: {title}")

            # Check specific target document
            target_uuid = "2cd4a90e-4c8b-59eb-9cd6-2accc05970da"
            matched_target = [d for d in stale_docs if str(d[0]) == target_uuid]
            if matched_target:
                print(f"\n[CONFIRMED] Stale document UUID {target_uuid} ('{matched_target[0][1]}') identified.")
            else:
                print(f"\n[WARNING] Stale document UUID {target_uuid} not found in stale list!")

            # 3. Delete stale rows
            if stale_doc_ids:
                print("\n--- DELETING STALE ROWS ---")
                cur.execute(
                    "DELETE FROM kb_chunks WHERE tenant_id = %s AND document_id = ANY(%s);",
                    (TENANT_ID, stale_doc_ids),
                )
                deleted_chunks = cur.rowcount
                print(f"Deleted {deleted_chunks} stale chunk(s) from kb_chunks.")

                cur.execute(
                    "DELETE FROM kb_documents WHERE tenant_id = %s AND id = ANY(%s);",
                    (TENANT_ID, stale_doc_ids),
                )
                deleted_docs = cur.rowcount
                print(f"Deleted {deleted_docs} stale document(s) from kb_documents.")

                conn.commit()
                print("Database transaction successfully committed.")
            else:
                print("\nNo stale documents found to delete.")

    # 4. Re-ingest corpus cleanly
    print("\n--- RE-INGESTING 55 CORPUS DOCUMENTS ---")
    ingest_result = asyncio.run(
        ingest_corpus(
            corpus_dir=CORPUS_DIR,
            tenant_id=TENANT_ID,
            db_url=DB_URL,
        )
    )
    print(f"Ingestion result: {ingest_result}")

    # 5. Verify post-condition
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM kb_documents WHERE tenant_id = %s;", (TENANT_ID,))
            doc_count_after = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM kb_chunks WHERE tenant_id = %s;", (TENANT_ID,))
            chunk_count_after = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*)
                FROM kb_documents
                WHERE tenant_id = %s AND source NOT LIKE 'corpus/%%';
                """,
                (TENANT_ID,),
            )
            stale_remaining = cur.fetchone()[0]

            print("\n--- AFTER CLEANUP AND RE-INGESTION ---")
            print(f"Total kb_documents for '{TENANT_ID}': {doc_count_after}")
            print(f"Total kb_chunks for '{TENANT_ID}': {chunk_count_after}")
            print(f"Non-corpus documents remaining: {stale_remaining}")

            # Verify exactly 55 documents
            if doc_count_after == 55 and stale_remaining == 0:
                print("\n[VERIFIED] Exactly 55 documents remain for tenant_eval_01. Zero stale documents.")
            else:
                print(f"\n[FAILED] Expected 55 documents and 0 stale, got {doc_count_after} and {stale_remaining}.")
                sys.exit(1)


if __name__ == "__main__":
    main()
