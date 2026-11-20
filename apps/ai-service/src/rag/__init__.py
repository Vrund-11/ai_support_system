"""SupportPilot AI RAG pipeline module."""

from src.rag.confidence import (
    calculate_citation_coverage,
    compute_composite_confidence,
    normalize_top_chunk_score,
)
from src.rag.prompt import build_system_prompt, build_user_prompt
from src.rag.service import RagService
from src.rag.validator import generate_json_with_repair, verify_citations

__all__ = [
    "RagService",
    "build_system_prompt",
    "build_user_prompt",
    "calculate_citation_coverage",
    "compute_composite_confidence",
    "generate_json_with_repair",
    "normalize_top_chunk_score",
    "verify_citations",
]
