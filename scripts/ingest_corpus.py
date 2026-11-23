"""Ingest all markdown documents from tests/ai-eval/corpus/ into SupportPilot knowledge base."""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import time
import uuid
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "ai-service"))

from src.config import settings
from src.embeddings import SbertProvider, get_embedding_provider
from src.ingest.chunker import DocumentChunker
from src.ingest.extract import clean_text
from src.ingest.repository import (
    BaseIngestRepository,
    MemoryIngestRepository,
    PostgresIngestRepository,
    get_ingest_repository,
)


def extract_title(content: str, default: str) -> str:
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return default


async def ingest_corpus(
    corpus_dir: Path,
    tenant_id: str = "tenant_eval_01",
    repository: BaseIngestRepository | None = None,
    db_url: str | None = None,
) -> dict:
    start_time = time.perf_counter()
    files = sorted(list(corpus_dir.glob("*.md")))
    if not files:
        print(f"Error: No .md files found in {corpus_dir}")
        return {"documents": 0, "chunks": 0, "elapsed_sec": 0}

    print(f"Discovered {len(files)} corpus documents in {corpus_dir}")

    # Determine repository
    if repository is None:
        target_dsn = db_url or settings.database_url
        if target_dsn:
            repo = PostgresIngestRepository(dsn=target_dsn)
            await repo.init_schema()
            repository = repo
            print("Using PostgresIngestRepository (PostgreSQL pgvector)")
        else:
            repository = MemoryIngestRepository()

    embedding_provider = get_embedding_provider("sbert")
    chunker = DocumentChunker(target_tokens=500, overlap_tokens=80)

    total_chunks = 0
    total_docs = 0

    for file in files:
        raw_text = file.read_text(encoding="utf-8")
        cleaned = clean_text(raw_text)
        title = extract_title(raw_text, file.stem)
        doc_slug = file.stem
        # Deterministic UUID for database compatibility
        doc_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{tenant_id}:{doc_slug}"))

        await repository.upsert_document(
            tenant_id=tenant_id,
            document_id=doc_uuid,
            title=title,
            source=f"corpus/{file.name}",
            status="PROCESSING",
        )

        chunks = chunker.chunk_document(cleaned)
        # Attach doc_slug and embedding_model to chunk metadata
        for c in chunks:
            c.metadata["doc_slug"] = doc_slug
            c.metadata["embedding_model"] = "sentence-transformers/all-MiniLM-L6-v2"

        texts = [c.content for c in chunks]
        embeddings = embedding_provider.embed(texts)

        await repository.save_chunks_transaction(
            tenant_id=tenant_id,
            document_id=doc_uuid,
            chunks=chunks,
            embeddings=embeddings,
        )

        total_chunks += len(chunks)
        total_docs += 1

    elapsed = round(time.perf_counter() - start_time, 2)
    print(f"Ingestion complete: {total_docs} documents, {total_chunks} chunks in {elapsed}s.")
    return {
        "documents": total_docs,
        "chunks": total_chunks,
        "elapsed_sec": elapsed,
        "tenant_id": tenant_id,
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Markdown corpus into SupportPilot")
    parser.add_argument("--corpus-dir", type=str, default="tests/ai-eval/corpus", help="Path to corpus directory")
    parser.add_argument("--tenant-id", type=str, default="tenant_eval_01", help="Target tenant ID")
    parser.add_argument("--db-url", type=str, default=None, help="PostgreSQL connection string override")

    args = parser.parse_args()
    asyncio.run(
        ingest_corpus(
            corpus_dir=Path(args.corpus_dir),
            tenant_id=args.tenant_id,
            db_url=args.db_url,
        )
    )


if __name__ == "__main__":
    main()
