"""Confidence scoring and calibration for RAG answers (AI-3)."""

from src.retrieval.hybrid import SearchResultChunk
from src.schemas.llm import CitationItem


def normalize_top_chunk_score(
    chunk: SearchResultChunk | None,
    k: int = 20,
    vector_weight: float = 1.0,
    text_weight: float = 0.7,
) -> float:
    """Normalize top retrieved chunk score to [0.0, 1.0]."""
    if chunk is None:
        return 0.0

    # 1. If vector similarity score is available, use it directly (cosine similarity ~ [0, 1])
    if chunk.vector_score is not None and chunk.vector_score > 0.0:
        return min(1.0, max(0.0, float(chunk.vector_score)))

    # 2. If score is available and looks like direct similarity score (> 0.15), use it
    if chunk.score > 0.15 and (chunk.rrf_score is None or chunk.rrf_score == chunk.score):
        return min(1.0, max(0.0, float(chunk.score)))

    # 3. If RRF score is available:
    if chunk.rrf_score > 0.0:
        # Check if legacy k=60 / unweighted max_rrf was specifically used (e.g. test_rag.py)
        legacy_max_rrf = 2.0 / 61.0
        if abs(chunk.rrf_score - legacy_max_rrf) < 1e-5:
            return 1.0

        # Tuned RRF normalization with weights (default: k=20, vector_weight=1.0, text_weight=0.7)
        max_rrf = (vector_weight + text_weight) / (k + 1.0)
        return min(1.0, max(0.0, chunk.rrf_score / max_rrf))

    # 4. Fallback to direct score if present
    if chunk.score > 0.0:
        return min(1.0, max(0.0, float(chunk.score)))

    return 0.0


def calculate_citation_coverage(citations: list[CitationItem], valid_chunk_ids: set[str]) -> float:
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
