"""Confidence scoring and calibration for RAG answers (AI-3)."""

from src.retrieval.hybrid import SearchResultChunk
from src.schemas.llm import CitationItem


def normalize_top_chunk_score(chunk: SearchResultChunk | None) -> float:
    """Normalize top retrieved chunk score to [0.0, 1.0]."""
    if chunk is None:
        return 0.0

    # If vector similarity score is available, use it directly (cosine similarity ~ [0, 1])
    if chunk.vector_score is not None and chunk.vector_score > 0.0:
        return min(1.0, max(0.0, float(chunk.vector_score)))

    # If RRF score is available, normalize against top rank 1 in both systems: 2 / (k + 1)
    if chunk.rrf_score > 0.0:
        max_rrf = 2.0 / 61.0  # k=60
        return min(1.0, max(0.0, chunk.rrf_score / max_rrf))

    return 0.0


def calculate_citation_coverage(
    citations: list[CitationItem], valid_chunk_ids: set[str]
) -> float:
    """Fraction of citations that are grounded in retrieved context."""
    if not citations:
        return 0.0

    grounded_count = sum(1 for c in citations if c.chunk_id in valid_chunk_ids)
    if grounded_count == 0:
        return 0.0

    # Ratio of grounded citations over total citations provided
    coverage = grounded_count / len(citations)
    return min(1.0, max(0.0, coverage))


def compute_composite_confidence(
    top_score_norm: float,
    citation_coverage: float,
    self_rating: float,
) -> float:
    """Compute calibrated confidence score:

    0.5 * top_score_norm + 0.3 * citation_coverage + 0.2 * self_rating
    """
    raw = (0.5 * top_score_norm) + (0.3 * citation_coverage) + (0.2 * self_rating)
    return round(min(1.0, max(0.0, raw)), 3)
