"""Repository for KB documents and chunks with pgvector support and in-memory test fallback."""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import psycopg

from src.config import settings
from src.ingest.chunker import DocumentChunk


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2, strict=True))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass
class StoredDocument:
    id: str
    tenant_id: str
    title: str
    source: str
    s3_key: str | None
    status: str  # PENDING | PROCESSING | READY | FAILED
    error: str | None
    chunk_count: int = 0
    version: int = 1
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class StoredChunk:
    id: str
    tenant_id: str
    document_id: str
    chunk_index: int
    content: str
    section_path: str
    token_count: int
    embedding: list[float]
    metadata: dict[str, Any]


class BaseIngestRepository:
    """Interface for document and chunk storage."""

    async def upsert_document(
        self,
        tenant_id: str,
        document_id: str,
        title: str,
        source: str = "upload",
        s3_key: str | None = None,
        status: str = "PENDING",
    ) -> StoredDocument:
        raise NotImplementedError

    async def get_document(self, tenant_id: str, document_id: str) -> StoredDocument | None:
        raise NotImplementedError

    async def update_document_status(
        self,
        tenant_id: str,
        document_id: str,
        status: str,
        error: str | None = None,
        chunk_count: int | None = None,
    ) -> None:
        raise NotImplementedError

    async def save_chunks_transaction(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
        embeddings: list[list[float]],
    ) -> None:
        """Idempotent transaction: replaces old chunks with new chunks and sets status READY."""
        raise NotImplementedError

    async def get_chunks_for_document(self, tenant_id: str, document_id: str) -> list[StoredChunk]:
        raise NotImplementedError

    async def vector_search(
        self, tenant_id: str, query_embedding: list[float], limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        raise NotImplementedError

    async def text_search(
        self, tenant_id: str, query_text: str, limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        raise NotImplementedError


class MemoryIngestRepository(BaseIngestRepository):
    """In-memory repository for unit tests and hermetic execution without live PostgreSQL."""

    def __init__(self) -> None:
        self.documents: dict[tuple[str, str], StoredDocument] = {}  # (tenant_id, doc_id) -> doc
        self.chunks: dict[tuple[str, str], list[StoredChunk]] = {}  # (tenant_id, doc_id) -> chunks

    async def upsert_document(
        self,
        tenant_id: str,
        document_id: str,
        title: str,
        source: str = "upload",
        s3_key: str | None = None,
        status: str = "PENDING",
    ) -> StoredDocument:
        key = (tenant_id, document_id)
        existing = self.documents.get(key)
        now = datetime.now(UTC)
        if existing:
            existing.title = title
            existing.status = status
            existing.s3_key = s3_key
            existing.version += 1
            existing.updated_at = now
            return existing

        doc = StoredDocument(
            id=document_id,
            tenant_id=tenant_id,
            title=title,
            source=source,
            s3_key=s3_key,
            status=status,
            error=None,
            version=1,
            created_at=now,
            updated_at=now,
        )
        self.documents[key] = doc
        return doc

    async def get_document(self, tenant_id: str, document_id: str) -> StoredDocument | None:
        return self.documents.get((tenant_id, document_id))

    async def update_document_status(
        self,
        tenant_id: str,
        document_id: str,
        status: str,
        error: str | None = None,
        chunk_count: int | None = None,
    ) -> None:
        doc = self.documents.get((tenant_id, document_id))
        if doc:
            doc.status = status
            doc.error = error
            doc.updated_at = datetime.now(UTC)
            if chunk_count is not None:
                doc.chunk_count = chunk_count

    async def save_chunks_transaction(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
        embeddings: list[list[float]],
    ) -> None:
        # Idempotent re-ingest: delete previous chunks for this document
        key = (tenant_id, document_id)
        self.chunks[key] = []

        stored: list[StoredChunk] = []
        for i, chunk in enumerate(chunks):
            meta = dict(chunk.metadata) if hasattr(chunk, "metadata") and chunk.metadata else {}
            meta.setdefault("embedding_model", "sentence-transformers/all-MiniLM-L6-v2")
            stored.append(
                StoredChunk(
                    id=f"{document_id}_{chunk.chunk_index}",
                    tenant_id=tenant_id,
                    document_id=document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    section_path=chunk.section_path,
                    token_count=chunk.token_count,
                    embedding=embeddings[i] if i < len(embeddings) else [],
                    metadata=meta,
                )
            )

        self.chunks[key] = stored
        await self.update_document_status(
            tenant_id=tenant_id,
            document_id=document_id,
            status="READY",
            error=None,
            chunk_count=len(stored),
        )

    async def get_chunks_for_document(self, tenant_id: str, document_id: str) -> list[StoredChunk]:
        return self.chunks.get((tenant_id, document_id), [])

    async def vector_search(
        self, tenant_id: str, query_embedding: list[float], limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        tenant_chunks: list[StoredChunk] = []
        for (t_id, _), chunks in self.chunks.items():
            if t_id == tenant_id:
                tenant_chunks.extend(chunks)

        scored: list[tuple[StoredChunk, float]] = []
        for chunk in tenant_chunks:
            if not chunk.embedding:
                continue
            sim = _cosine_similarity(query_embedding, chunk.embedding)
            scored.append((chunk, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:limit]

    async def text_search(
        self, tenant_id: str, query_text: str, limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        import re

        words = [w.lower() for w in re.findall(r"\w+", query_text) if len(w) > 2]
        if not words:
            return []

        tenant_chunks: list[StoredChunk] = []
        for (t_id, _), chunks in self.chunks.items():
            if t_id == tenant_id:
                tenant_chunks.extend(chunks)

        scored: list[tuple[StoredChunk, float]] = []
        for chunk in tenant_chunks:
            content_lower = chunk.content.lower()
            matches = sum(1 for w in words if w in content_lower)
            if matches > 0:
                tf = sum(content_lower.count(w) for w in words)
                score = (matches / len(words)) + (tf / (len(chunk.content.split()) + 1.0))
                scored.append((chunk, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:limit]


class PostgresIngestRepository(BaseIngestRepository):
    """PostgreSQL + pgvector repository enforcing strict tenant isolation."""

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn or settings.database_url

    async def _get_connection(self) -> psycopg.AsyncConnection:
        try:
            return await psycopg.AsyncConnection.connect(self.dsn)
        except psycopg.OperationalError:
            if ":5432" in self.dsn:
                alt_dsn = self.dsn.replace(":5432", ":5433")
                try:
                    conn = await psycopg.AsyncConnection.connect(alt_dsn)
                    self.dsn = alt_dsn
                    return conn
                except Exception:
                    pass
            raise

    async def init_schema(self) -> None:
        """Create vector extension, migrate to vector(384) if supported, and create tables."""
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            has_vector = False
            try:
                await cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                await conn.commit()
                has_vector = True
            except Exception:
                await conn.rollback()
                has_vector = False

            if has_vector:
                # Migrate double precision[] column to vector(384) if migrating from legacy schema
                await cur.execute(
                    """
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name = 'kb_chunks'
                              AND column_name = 'embedding'
                              AND data_type = 'ARRAY'
                        ) THEN
                            ALTER TABLE kb_chunks
                            ALTER COLUMN embedding TYPE vector(384)
                            USING ('[' || array_to_string(embedding, ',') || ']')::vector(384);
                        END IF;
                    END $$;
                    """
                )

            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS kb_documents (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'upload',
                    s3_key TEXT,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    error TEXT,
                    version INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS idx_kb_docs_tenant
                    ON kb_documents(tenant_id, status);
                """
            )

            embedding_type = "vector(384)" if has_vector else "float8[]"
            await cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS kb_chunks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id TEXT NOT NULL,
                    document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
                    chunk_index INT NOT NULL,
                    content TEXT NOT NULL,
                    section_path TEXT NOT NULL DEFAULT '',
                    token_count INT NOT NULL DEFAULT 0,
                    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
                    embedding {embedding_type} NOT NULL,
                    metadata JSONB NOT NULL DEFAULT '{{}}',
                    UNIQUE (document_id, chunk_index)
                );
                CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant ON kb_chunks(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_kb_chunks_tsv ON kb_chunks USING gin(tsv);
                CREATE INDEX IF NOT EXISTS idx_kb_chunks_tenant_tsv ON kb_chunks(tenant_id, tsv);
                """
            )

            if has_vector:
                await cur.execute(
                    """
                    DROP INDEX IF EXISTS idx_kb_chunks_embedding;
                    CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding
                        ON kb_chunks USING hnsw (embedding vector_cosine_ops)
                        WITH (m = 16, ef_construction = 64);
                    """
                )
            await conn.commit()

    async def upsert_document(
        self,
        tenant_id: str,
        document_id: str,
        title: str,
        source: str = "upload",
        s3_key: str | None = None,
        status: str = "PENDING",
    ) -> StoredDocument:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO kb_documents
                    (id, tenant_id, title, source, s3_key, status, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    status = EXCLUDED.status,
                    s3_key = EXCLUDED.s3_key,
                    version = kb_documents.version + 1,
                    updated_at = now()
                RETURNING id, tenant_id, title, source, s3_key, status,
                          error, version, created_at, updated_at;
                """,
                (document_id, tenant_id, title, source, s3_key, status),
            )
            row = await cur.fetchone()
            await conn.commit()
            assert row is not None
            return StoredDocument(
                id=str(row[0]),
                tenant_id=str(row[1]),
                title=str(row[2]),
                source=str(row[3]),
                s3_key=row[4],
                status=str(row[5]),
                error=row[6],
                version=int(row[7]),
                created_at=row[8],
                updated_at=row[9],
            )

    async def get_document(self, tenant_id: str, document_id: str) -> StoredDocument | None:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, tenant_id, title, source, s3_key, status,
                       error, version, created_at, updated_at
                FROM kb_documents
                WHERE tenant_id = %s AND id = %s;
                """,
                (tenant_id, document_id),
            )
            row = await cur.fetchone()
            if not row:
                return None
            return StoredDocument(
                id=str(row[0]),
                tenant_id=str(row[1]),
                title=str(row[2]),
                source=str(row[3]),
                s3_key=row[4],
                status=str(row[5]),
                error=row[6],
                version=int(row[7]),
                created_at=row[8],
                updated_at=row[9],
            )

    async def update_document_status(
        self,
        tenant_id: str,
        document_id: str,
        status: str,
        error: str | None = None,
        chunk_count: int | None = None,
    ) -> None:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE kb_documents
                SET status = %s, error = %s, updated_at = now()
                WHERE tenant_id = %s AND id = %s;
                """,
                (status, error, tenant_id, document_id),
            )
            await conn.commit()

    async def save_chunks_transaction(
        self,
        tenant_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
        embeddings: list[list[float]],
    ) -> None:
        # Atomic transaction: delete previous chunks, insert new ones, set status READY
        conn = await self._get_connection()
        async with conn, conn.transaction(), conn.cursor() as cur:
            # Idempotent delete of existing chunks
            await cur.execute(
                "DELETE FROM kb_chunks WHERE tenant_id = %s AND document_id = %s;",
                (tenant_id, document_id),
            )

            # Check if embedding column is vector or array
            await cur.execute(
                """
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'kb_chunks' AND column_name = 'embedding';
                """
            )
            col_info = await cur.fetchone()
            is_vector_udt = bool(col_info and col_info[0] == "vector")

            # Bulk insert new chunks
            for i, chunk in enumerate(chunks):
                raw_emb = embeddings[i] if i < len(embeddings) else []
                meta = dict(chunk.metadata) if hasattr(chunk, "metadata") and chunk.metadata else {}
                meta.setdefault("embedding_model", "sentence-transformers/all-MiniLM-L6-v2")
                meta_json = json.dumps(meta)
                if is_vector_udt:
                    emb_str = f"[{','.join(str(x) for x in raw_emb)}]"
                    await cur.execute(
                        """
                        INSERT INTO kb_chunks (
                            tenant_id, document_id, chunk_index, content,
                            section_path, token_count, embedding, metadata
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s::vector, %s::jsonb);
                        """,
                        (
                            tenant_id,
                            document_id,
                            chunk.chunk_index,
                            chunk.content,
                            chunk.section_path,
                            chunk.token_count,
                            emb_str,
                            meta_json,
                        ),
                    )
                else:
                    await cur.execute(
                        """
                        INSERT INTO kb_chunks (
                            tenant_id, document_id, chunk_index, content,
                            section_path, token_count, embedding, metadata
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb);
                        """,
                        (
                            tenant_id,
                            document_id,
                            chunk.chunk_index,
                            chunk.content,
                            chunk.section_path,
                            chunk.token_count,
                            raw_emb,
                            meta_json,
                        ),
                    )

            # Update status to READY
            await cur.execute(
                """
                UPDATE kb_documents
                SET status = 'READY', error = NULL, updated_at = now()
                WHERE tenant_id = %s AND id = %s;
                """,
                (tenant_id, document_id),
            )

    async def get_chunks_for_document(self, tenant_id: str, document_id: str) -> list[StoredChunk]:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, tenant_id, document_id, chunk_index, content,
                       section_path, token_count, embedding, metadata
                FROM kb_chunks
                WHERE tenant_id = %s AND document_id = %s
                ORDER BY chunk_index ASC;
                """,
                (tenant_id, document_id),
            )
            rows = await cur.fetchall()
            results: list[StoredChunk] = []
            for row in rows:
                raw_emb = row[7]
                emb_list: list[float]
                if isinstance(raw_emb, list):
                    emb_list = [float(x) for x in raw_emb]
                elif isinstance(raw_emb, str):
                    emb_list = [float(x) for x in raw_emb.strip("[]").split(",") if x.strip()]
                else:
                    emb_list = list(raw_emb) if raw_emb is not None else []

                results.append(
                    StoredChunk(
                        id=str(row[0]),
                        tenant_id=str(row[1]),
                        document_id=str(row[2]),
                        chunk_index=int(row[3]),
                        content=str(row[4]),
                        section_path=str(row[5]),
                        token_count=int(row[6]),
                        embedding=emb_list,
                        metadata=dict(row[8]) if row[8] is not None else {},
                    )
                )
            return results

    async def vector_search(
        self, tenant_id: str, query_embedding: list[float], limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'kb_chunks' AND column_name = 'embedding';
                """
            )
            col_info = await cur.fetchone()
            is_vector_udt = bool(col_info and col_info[0] == "vector")

            if is_vector_udt:
                emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
                await cur.execute("SET hnsw.ef_search = 40;")
                await cur.execute(
                    """
                    SELECT id, tenant_id, document_id, chunk_index, content,
                           section_path, token_count, embedding, metadata,
                           1 - (embedding <=> %s::vector) AS score
                    FROM kb_chunks
                    WHERE tenant_id = %s
                      AND (metadata->>'embedding_model' = %s
                           OR metadata->>'embedding_model' IS NULL)
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (
                        emb_str,
                        tenant_id,
                        "sentence-transformers/all-MiniLM-L6-v2",
                        emb_str,
                        limit,
                    ),
                )
                rows = await cur.fetchall()
                results: list[tuple[StoredChunk, float]] = []
                for row in rows:
                    raw_emb = row[7]
                    emb_list: list[float]
                    if isinstance(raw_emb, list):
                        emb_list = [float(x) for x in raw_emb]
                    elif isinstance(raw_emb, str):
                        emb_list = [float(x) for x in raw_emb.strip("[]").split(",") if x.strip()]
                    else:
                        emb_list = list(raw_emb) if raw_emb is not None else []

                    chunk = StoredChunk(
                        id=str(row[0]),
                        tenant_id=str(row[1]),
                        document_id=str(row[2]),
                        chunk_index=int(row[3]),
                        content=str(row[4]),
                        section_path=str(row[5]),
                        token_count=int(row[6]),
                        embedding=emb_list,
                        metadata=dict(row[8]) if row[8] is not None else {},
                    )
                    score = float(row[9])
                    results.append((chunk, score))
                return results
            else:
                await cur.execute(
                    """
                    SELECT id, tenant_id, document_id, chunk_index, content,
                           section_path, token_count, embedding, metadata
                    FROM kb_chunks
                    WHERE tenant_id = %s;
                    """,
                    (tenant_id,),
                )
                rows = await cur.fetchall()
                scored: list[tuple[StoredChunk, float]] = []
                for row in rows:
                    raw_emb = row[7]
                    emb_list: list[float]
                    if isinstance(raw_emb, list):
                        emb_list = [float(x) for x in raw_emb]
                    elif isinstance(raw_emb, str):
                        emb_list = [float(x) for x in raw_emb.strip("[]").split(",") if x.strip()]
                    else:
                        emb_list = list(raw_emb) if raw_emb is not None else []

                    chunk = StoredChunk(
                        id=str(row[0]),
                        tenant_id=str(row[1]),
                        document_id=str(row[2]),
                        chunk_index=int(row[3]),
                        content=str(row[4]),
                        section_path=str(row[5]),
                        token_count=int(row[6]),
                        embedding=emb_list,
                        metadata=dict(row[8]) if row[8] is not None else {},
                    )
                    sim = _cosine_similarity(query_embedding, emb_list)
                    scored.append((chunk, sim))
                scored.sort(key=lambda x: x[1], reverse=True)
                return scored[:limit]

    async def text_search(
        self, tenant_id: str, query_text: str, limit: int = 20
    ) -> list[tuple[StoredChunk, float]]:
        conn = await self._get_connection()
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, tenant_id, document_id, chunk_index, content,
                       section_path, token_count, embedding, metadata,
                       ts_rank_cd(tsv, plainto_tsquery('english', %s)) AS score
                FROM kb_chunks
                WHERE tenant_id = %s AND tsv @@ plainto_tsquery('english', %s)
                ORDER BY score DESC
                LIMIT %s;
                """,
                (query_text, tenant_id, query_text, limit),
            )
            rows = await cur.fetchall()
            results: list[tuple[StoredChunk, float]] = []
            for row in rows:
                chunk = StoredChunk(
                    id=str(row[0]),
                    tenant_id=str(row[1]),
                    document_id=str(row[2]),
                    chunk_index=int(row[3]),
                    content=str(row[4]),
                    section_path=str(row[5]),
                    token_count=int(row[6]),
                    embedding=list(row[7]) if row[7] is not None else [],
                    metadata=dict(row[8]) if row[8] is not None else {},
                )
                score = float(row[9])
                results.append((chunk, score))
            return results


# Global repository instance (defaults to MemoryIngestRepository for hermetic local execution)
_active_repository: BaseIngestRepository = MemoryIngestRepository()


def get_ingest_repository() -> BaseIngestRepository:
    return _active_repository


def set_ingest_repository(repo: BaseIngestRepository) -> None:
    global _active_repository
    _active_repository = repo
