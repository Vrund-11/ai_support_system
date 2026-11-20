"""Ingestion pipeline coordinating extraction, chunking, batch embedding, and storage."""

from dataclasses import dataclass

from src.ingest.chunker import DocumentChunk, DocumentChunker
from src.ingest.extract import clean_text
from src.ingest.repository import BaseIngestRepository, get_ingest_repository
from src.providers.base import LLMProvider
from src.providers.factory import get_llm_provider


@dataclass
class IngestionResult:
    document_id: str
    tenant_id: str
    status: str
    chunks_count: int
    char_count: int
    token_count: int
    error: str | None = None


class IngestionPipeline:
    """Orchestrates document ingestion lifecycle (PENDING -> PROCESSING -> READY | FAILED)."""

    def __init__(
        self,
        repository: BaseIngestRepository | None = None,
        llm_provider: LLMProvider | None = None,
        chunker: DocumentChunker | None = None,
        batch_size: int = 32,
    ) -> None:
        self.repository = repository or get_ingest_repository()
        self.llm_provider = llm_provider or get_llm_provider()
        self.chunker = chunker or DocumentChunker(target_tokens=500, overlap_tokens=80)
        self.batch_size = batch_size

    async def ingest_document(
        self,
        tenant_id: str,
        document_id: str,
        raw_text: str,
        title: str = "Untitled Document",
        source: str = "upload",
        s3_key: str | None = None,
    ) -> IngestionResult:
        """Run full extraction, chunking, embedding, and storage in an idempotent transaction."""
        # 1. Initialize or get document record in PENDING status
        await self.repository.upsert_document(
            tenant_id=tenant_id,
            document_id=document_id,
            title=title,
            source=source,
            s3_key=s3_key,
            status="PENDING",
        )

        # 2. Transition status PENDING -> PROCESSING
        await self.repository.update_document_status(
            tenant_id=tenant_id,
            document_id=document_id,
            status="PROCESSING",
        )

        try:
            # 3. Clean and normalize text
            cleaned = clean_text(raw_text)
            if not cleaned:
                raise ValueError("Document contains no readable text content after extraction")

            char_count = len(cleaned)

            # 4. Heading-aware chunking
            chunks: list[DocumentChunk] = self.chunker.chunk_document(cleaned)
            if not chunks:
                raise ValueError("Chunker produced 0 chunks from document content")

            total_tokens = sum(c.token_count for c in chunks)

            # 5. Batch embed chunks (batch 32 per PRD / 08-ai-ml-plan)
            all_embeddings: list[list[float]] = []
            for i in range(0, len(chunks), self.batch_size):
                batch = chunks[i : i + self.batch_size]
                texts = [c.content for c in batch]
                batch_embeddings = await self.llm_provider.get_embeddings(texts)
                all_embeddings.extend(batch_embeddings)

            # 6. Idempotently write to repository in a single transaction
            await self.repository.save_chunks_transaction(
                tenant_id=tenant_id,
                document_id=document_id,
                chunks=chunks,
                embeddings=all_embeddings,
            )

            return IngestionResult(
                document_id=document_id,
                tenant_id=tenant_id,
                status="READY",
                chunks_count=len(chunks),
                char_count=char_count,
                token_count=total_tokens,
            )

        except Exception as exc:
            # On failure: transition status to FAILED with error message
            error_message = str(exc)
            await self.repository.update_document_status(
                tenant_id=tenant_id,
                document_id=document_id,
                status="FAILED",
                error=error_message,
            )
            return IngestionResult(
                document_id=document_id,
                tenant_id=tenant_id,
                status="FAILED",
                chunks_count=0,
                char_count=len(raw_text),
                token_count=0,
                error=error_message,
            )
