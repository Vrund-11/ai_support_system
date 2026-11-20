"""Hybrid retrieval with Reciprocal Rank Fusion (RRF) and strict tenant isolation."""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from src.ingest.repository import BaseIngestRepository, StoredChunk, get_ingest_repository
from src.providers.base import LLMProvider
from src.providers.factory import get_llm_provider


@dataclass
class SearchResultChunk:
    id: str
    document_id: str
    chunk_index: int
    content: str
    section_path: str
    token_count: int
    score: float
    rrf_score: float
    vector_rank: int | None = None
    text_rank: int | None = None
    vector_score: float | None = None
    text_score: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class HybridRetriever:
    """Combines vector similarity search and keyword full-text search with RRF."""

    def __init__(
        self,
        repository: BaseIngestRepository | None = None,
        llm_provider: LLMProvider | None = None,
    ) -> None:
        self._repo = repository
        self._provider = llm_provider

    @property
    def repo(self) -> BaseIngestRepository:
        return self._repo or get_ingest_repository()

    @property
    def provider(self) -> LLMProvider:
        return self._provider or get_llm_provider()

    @staticmethod
    def compute_rrf(
        vector_results: list[tuple[StoredChunk, float]],
        text_results: list[tuple[StoredChunk, float]],
        k: int = 60,
    ) -> list[SearchResultChunk]:
        """Compute Reciprocal Rank Fusion scores across ranked lists:

        RRF_score(d) = sum(1.0 / (k + rank))
        """
        scores: dict[str, float] = {}
        chunks_by_id: dict[str, StoredChunk] = {}
        vector_ranks: dict[str, int] = {}
        text_ranks: dict[str, int] = {}
        vector_scores: dict[str, float] = {}
        text_scores: dict[str, float] = {}

        for rank, (chunk, v_score) in enumerate(vector_results, start=1):
            chunks_by_id[chunk.id] = chunk
            vector_ranks[chunk.id] = rank
            vector_scores[chunk.id] = v_score
            scores[chunk.id] = scores.get(chunk.id, 0.0) + (1.0 / (k + rank))

        for rank, (chunk, t_score) in enumerate(text_results, start=1):
            chunks_by_id[chunk.id] = chunk
            text_ranks[chunk.id] = rank
            text_scores[chunk.id] = t_score
            scores[chunk.id] = scores.get(chunk.id, 0.0) + (1.0 / (k + rank))

        sorted_ids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)
        results: list[SearchResultChunk] = []

        for cid in sorted_ids:
            chunk = chunks_by_id[cid]
            rrf = scores[cid]
            results.append(
                SearchResultChunk(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    section_path=chunk.section_path,
                    token_count=chunk.token_count,
                    score=rrf,
                    rrf_score=rrf,
                    vector_rank=vector_ranks.get(cid),
                    text_rank=text_ranks.get(cid),
                    vector_score=vector_scores.get(cid),
                    text_score=text_scores.get(cid),
                    metadata=chunk.metadata,
                )
            )

        return results

    async def retrieve(
        self,
        tenant_id: str,
        query: str,
        top_k: int = 5,
        vector_top_k: int = 20,
        text_top_k: int = 20,
        rrf_k: int = 60,
    ) -> list[SearchResultChunk]:
        """Execute hybrid search with strict tenant isolation."""
        if not query.strip():
            return []

        # 1. Embed query
        embeddings = await self.provider.get_embeddings([query])
        query_embedding = embeddings[0] if embeddings else []

        # 2. Parallel search with tenant filter
        vector_task = self.repo.vector_search(
            tenant_id=tenant_id,
            query_embedding=query_embedding,
            limit=vector_top_k,
        )
        text_task = self.repo.text_search(
            tenant_id=tenant_id,
            query_text=query,
            limit=text_top_k,
        )
        vector_results, text_results = await asyncio.gather(vector_task, text_task)

        # 3. Reciprocal Rank Fusion
        fused = self.compute_rrf(vector_results, text_results, k=rrf_k)

        # 4. Return top-k
        return fused[:top_k]
