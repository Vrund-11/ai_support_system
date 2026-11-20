"""Validation and repair retry logic for RAG generation (AI-2, AI-9, T-AI-02)."""

import logging

from pydantic import BaseModel

from src.providers.base import LLMProvider
from src.retrieval.hybrid import SearchResultChunk
from src.schemas.llm import CitationItem

logger = logging.getLogger(__name__)


def verify_citations(
    citations: list[CitationItem],
    retrieved_chunks: list[SearchResultChunk],
) -> tuple[bool, str | None]:
    """Verify that every cited chunk_id exists in retrieved chunks (T-AI-02).

    Returns (is_valid, error_reason).
    """
    if not citations:
        return True, None

    valid_chunk_ids = {c.id for c in retrieved_chunks}

    for citation in citations:
        if citation.chunk_id not in valid_chunk_ids:
            return (
                False,
                f"Ungrounded citation: chunk '{citation.chunk_id}' was not in retrieved context",
            )

    return True, None


async def generate_json_with_repair[T: BaseModel](
    provider: LLMProvider,
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    temperature: float = 0.2,
) -> tuple[T, int]:
    """Generate structured JSON with a single repair retry on malformed JSON / validation error.

    Returns (result, attempts_count).
    """
    try:
        res = await provider.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            schema=schema,
            temperature=temperature,
        )
        return res, 1
    except Exception as first_exc:
        logger.warning(
            "Initial JSON generation failed (%s). Triggering repair retry...",
            str(first_exc),
        )

        repair_prompt = (
            f"Your previous output failed JSON validation with error:\n"
            f"{first_exc!s}\n\n"
            f"Please repair the response and return strictly valid JSON matching the schema for:\n"
            f"{user_prompt}"
        )

        try:
            repaired = await provider.generate_json(
                system_prompt=system_prompt,
                user_prompt=repair_prompt,
                schema=schema,
                temperature=temperature,
            )
            logger.info("JSON repair retry succeeded.")
            return repaired, 2
        except Exception as retry_exc:
            logger.error("JSON repair retry failed: %s", str(retry_exc))
            raise retry_exc from first_exc
