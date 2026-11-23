"""Hybrid retrieval with Reciprocal Rank Fusion (RRF) and strict tenant isolation."""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from src.embeddings import EmbeddingProvider, get_embedding_provider
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

    def to_dict(self) -> dict[str, Any]:
        """Convert search result chunk to serializable dictionary preserving all scores."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "chunk_index": self.chunk_index,
            "content": self.content,
            "section_path": self.section_path,
            "token_count": self.token_count,
            "score": self.score,
            "rrf_score": self.rrf_score,
            "vector_rank": self.vector_rank,
            "text_rank": self.text_rank,
            "vector_score": self.vector_score,
            "text_score": self.text_score,
            "metadata": self.metadata,
        }


class HybridRetriever:
    """Combines vector similarity search and keyword full-text search with RRF."""

    def __init__(
        self,
        repository: BaseIngestRepository | None = None,
        llm_provider: LLMProvider | None = None,
        embedding_provider: EmbeddingProvider | None = None,
    ) -> None:
        self._repo = repository
        self._provider = llm_provider
        self._embedding_provider = embedding_provider

    @property
    def repo(self) -> BaseIngestRepository:
        return self._repo or get_ingest_repository()

    @property
    def provider(self) -> LLMProvider:
        return self._provider or get_llm_provider()

    @property
    def embedding_provider(self) -> EmbeddingProvider:
        return self._embedding_provider or get_embedding_provider()

    @staticmethod
    def compute_rrf(
        vector_results: list[tuple[StoredChunk, float]],
        text_results: list[tuple[StoredChunk, float]],
        k: int = 60,
        vector_weight: float = 1.0,
        text_weight: float = 1.0,
    ) -> list[SearchResultChunk]:
        """Compute Reciprocal Rank Fusion scores across ranked lists:

        RRF_score(d) = sum(weight / (k + rank))
        Default parameters tuned on v2 benchmark: k=20, vector_weight=1.0, text_weight=0.7.
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
            scores[chunk.id] = scores.get(chunk.id, 0.0) + (vector_weight / (k + rank))

        for rank, (chunk, t_score) in enumerate(text_results, start=1):
            chunks_by_id[chunk.id] = chunk
            text_ranks[chunk.id] = rank
            text_scores[chunk.id] = t_score
            scores[chunk.id] = scores.get(chunk.id, 0.0) + (text_weight / (k + rank))

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

    @staticmethod
    def rerank_candidates(
        query: str,
        candidates: list[SearchResultChunk],
    ) -> list[SearchResultChunk]:
        """Rerank candidates using section matches, token overlap, and phrase bonuses."""
        import re

        query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
        if not query_terms:
            return candidates

        def score_candidate(c: SearchResultChunk) -> float:
            content_lower = c.content.lower()
            section_lower = c.section_path.lower()
            section_matches = sum(2.0 for t in query_terms if t in section_lower)
            content_matches = sum(1.0 for t in query_terms if t in content_lower)
            phrase_bonus = 3.0 if query.lower().strip() in content_lower else 0.0
            term_score = (section_matches + content_matches + phrase_bonus) / (
                len(query_terms) + 1.0
            )
            return c.rrf_score * 0.4 + term_score * 0.6

        return sorted(candidates, key=score_candidate, reverse=True)

    async def retrieve(
        self,
        tenant_id: str,
        query: str,
        top_k: int = 5,
        vector_top_k: int = 20,
        text_top_k: int = 20,
        rrf_k: int = 20,
        vector_weight: float = 1.0,
        text_weight: float = 0.7,
        mode: str = "hybrid",
    ) -> list[SearchResultChunk]:
        """Execute hybrid search with strict tenant isolation.

        Supported modes:
        - "hybrid": Reciprocal Rank Fusion of vector and text search (default)
        - "vector_only": Pure dense vector search
        - "text_only": Pure lexical text search
        - "hybrid_rerank": Hybrid RRF followed by candidate reranking
        """
        if not query.strip():
            return []

        if mode == "text_only":
            text_results = await self.repo.text_search(
                tenant_id=tenant_id,
                query_text=query,
                limit=top_k,
            )
            return [
                SearchResultChunk(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    section_path=chunk.section_path,
                    token_count=chunk.token_count,
                    score=score,
                    rrf_score=score,
                    text_rank=rank,
                    text_score=score,
                    metadata=chunk.metadata,
                )
                for rank, (chunk, score) in enumerate(text_results, start=1)
            ]

        # 1. Embed query
        embeddings = await self.embedding_provider.aembed([query])
        query_embedding = embeddings[0] if embeddings else []

        if mode == "vector_only":
            vector_results = await self.repo.vector_search(
                tenant_id=tenant_id,
                query_embedding=query_embedding,
                limit=top_k,
            )
            return [
                SearchResultChunk(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    section_path=chunk.section_path,
                    token_count=chunk.token_count,
                    score=score,
                    rrf_score=score,
                    vector_rank=rank,
                    vector_score=score,
                    metadata=chunk.metadata,
                )
                for rank, (chunk, score) in enumerate(vector_results, start=1)
            ]

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
        fused = self.compute_rrf(
            vector_results,
            text_results,
            k=rrf_k,
            vector_weight=vector_weight,
            text_weight=text_weight,
        )

        if mode == "hybrid_rerank":
            candidates = fused[: max(top_k * 2, 10)]
            reranked = self.rerank_candidates(query, candidates)
            return reranked[:top_k]

        # 4. Return top-k
        return fused[:top_k]
