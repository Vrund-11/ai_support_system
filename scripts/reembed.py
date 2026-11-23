"""Batch re-embedding script for SupportPilot knowledge base chunks.

Re-embeds all existing kb_chunks using sentence-transformers/all-MiniLM-L6-v2,
updates metadata.embedding_model, and rebuilds the HNSW vector index.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "ai-service"))

import psycopg
from src.config import settings
from src.embeddings import SbertProvider

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


async def reembed_chunks(
    db_url: str,
    batch_size: int = 32,
    tenant_id: str | None = None,
    dry_run: bool = False,
    reindex: bool = True,
) -> dict:
    start_time = time.perf_counter()
    print(f"Connecting to PostgreSQL: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    try:
        conn = await psycopg.AsyncConnection.connect(db_url)
    except psycopg.OperationalError as exc:
        if ":5432" in db_url:
            alt_url = db_url.replace(":5432", ":5433")
            try:
                conn = await psycopg.AsyncConnection.connect(alt_url)
                print(f"Port 5432 unavailable due to local service; successfully connected to pgvector on port 5433.")
            except Exception:
                print(f"Failed to connect to database: {exc}")
                return {"success": False, "error": str(exc), "chunks_reembedded": 0}
        else:
            print(f"Failed to connect to database: {exc}")
            return {"success": False, "error": str(exc), "chunks_reembedded": 0}
    except Exception as exc:
        print(f"Failed to connect to database: {exc}")
        return {"success": False, "error": str(exc), "chunks_reembedded": 0}

    provider = SbertProvider(model_name=MODEL_NAME)
    print(f"Loading embedding model: {MODEL_NAME}")
    provider._load_model()
    print("Embedding model ready.")

    total_updated = 0

    async with conn:
        async with conn.cursor() as cur:
            # Verify pgvector column
            await cur.execute(
                "SELECT udt_name FROM information_schema.columns WHERE table_name = 'kb_chunks' AND column_name = 'embedding';"
            )
            col = await cur.fetchone()
            if not col or col[0] != "vector":
                raise RuntimeError(
                    f"kb_chunks.embedding column is {col[0] if col else 'missing'}, expected 'vector'. "
                    "Run schema migration before re-embedding."
                )

            query = "SELECT id, content, metadata FROM kb_chunks"
            params: list = []
            if tenant_id:
                query += " WHERE tenant_id = %s"
                params.append(tenant_id)
            query += " ORDER BY id;"

            await cur.execute(query, params)
            rows = await cur.fetchall()
            total_chunks = len(rows)
            print(f"Found {total_chunks} chunks to process.")

            if total_chunks == 0:
                print("No chunks found in database.")
                return {
                    "success": True,
                    "chunks_reembedded": 0,
                    "model": MODEL_NAME,
                    "elapsed_sec": round(time.perf_counter() - start_time, 2),
                }

            if dry_run:
                print("Dry-run requested. Skipping embedding updates.")
                return {
                    "success": True,
                    "chunks_reembedded": 0,
                    "dry_run": True,
                    "total_found": total_chunks,
                }

            for i in range(0, total_chunks, batch_size):
                batch = rows[i : i + batch_size]
                chunk_ids = [r[0] for r in batch]
                texts = [r[1] for r in batch]
                metas = [r[2] if isinstance(r[2], dict) else json.loads(r[2] or "{}") for r in batch]

                embeddings = provider.embed(texts)

                for cid, emb, meta in zip(chunk_ids, embeddings, metas):
                    meta["embedding_model"] = MODEL_NAME
                    meta_json = json.dumps(meta)
                    emb_str = f"[{','.join(str(x) for x in emb)}]"
                    await cur.execute(
                        """
                        UPDATE kb_chunks
                        SET embedding = %s::vector,
                            metadata = %s::jsonb
                        WHERE id = %s;
                        """,
                        (emb_str, meta_json, cid),
                    )
                    total_updated += 1

                await conn.commit()
                print(f"Processed batch {i // batch_size + 1} / {(total_chunks + batch_size - 1) // batch_size} ({total_updated}/{total_chunks})")

            if reindex:
                print("Rebuilding HNSW vector index: idx_kb_chunks_embedding...")
                try:
                    await cur.execute("REINDEX INDEX idx_kb_chunks_embedding;")
                    await conn.commit()
                    print("HNSW index successfully rebuilt.")
                except Exception as e:
                    print(f"Warning: Reindex failed or index did not exist: {e}")

    elapsed = round(time.perf_counter() - start_time, 2)
    print(f"\nCompleted re-embedding {total_updated} chunks with {MODEL_NAME} in {elapsed}s.")
    return {
        "success": True,
        "chunks_reembedded": total_updated,
        "model": MODEL_NAME,
        "elapsed_sec": elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description="Re-embed SupportPilot kb_chunks with SBERT")
    parser.add_argument("--batch-size", type=int, default=32, help="Embedding batch size (default 32)")
    parser.add_argument("--tenant-id", type=str, default=None, help="Optional tenant ID filter")
    parser.add_argument("--dry-run", action="store_true", help="Find chunks without modifying DB")
    parser.add_argument("--db-url", type=str, default=None, help="PostgreSQL connection string override")
    parser.add_argument("--no-reindex", action="store_true", help="Skip REINDEX INDEX step")

    args = parser.parse_args()
    db_url = args.db_url or settings.database_url

    result = asyncio.run(
        reembed_chunks(
            db_url=db_url,
            batch_size=args.batch_size,
            tenant_id=args.tenant_id,
            dry_run=args.dry_run,
            reindex=not args.no_reindex,
        )
    )
    if not result.get("success"):
        sys.exit(1)


if __name__ == "__main__":
    main()
