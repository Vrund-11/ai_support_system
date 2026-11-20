"""RAG answer generation service orchestrating retrieval, validation, and calibration."""

import logging

from src.cache.semantic import BaseSemanticCache, get_semantic_cache
from src.config import settings
from src.providers.base import LLMProvider
from src.providers.factory import get_llm_provider
from src.rag.confidence import (
    calculate_citation_coverage,
    compute_composite_confidence,
    normalize_top_chunk_score,
)
from src.rag.prompt import build_system_prompt, build_user_prompt
from src.rag.validator import generate_json_with_repair, verify_citations
from src.retrieval.hybrid import HybridRetriever, SearchResultChunk
from src.schemas.llm import (
    GenerateAnswerRequest,
    GenerateAnswerResponse,
    RagAnswer,
)

logger = logging.getLogger(__name__)


class RagService:
    """Orchestrates end-to-end RAG answer generation (AI-1, AI-2, AI-3, AI-9)."""

    def __init__(
        self,
        retriever: HybridRetriever | None = None,
        llm_provider: LLMProvider | None = None,
        cache: BaseSemanticCache | None = None,
    ) -> None:
        self.retriever = retriever or HybridRetriever()
        self.provider = llm_provider or get_llm_provider()
        self.cache = cache or get_semantic_cache()

    async def generate_answer(
        self, req: GenerateAnswerRequest
    ) -> GenerateAnswerResponse:
        """Execute full RAG generation pipeline with grounding checks and calibrated confidence."""
        # 0. Check semantic response cache (AI-7)
        cached_response = await self.cache.get(
            tenant_id=req.tenant_id,
            question=req.question,
        )
        if cached_response is not None:
            logger.info("Semantic cache hit for tenant '%s'", req.tenant_id)
            return cached_response

        # 1. Retrieve knowledge chunks
        chunks: list[SearchResultChunk] = []
        if req.retrieved_chunks:
            # Chunks pre-provided by caller
            for item in req.retrieved_chunks:
                chunks.append(
                    SearchResultChunk(
                        id=str(item.get("id", "")),
                        document_id=str(item.get("document_id", "")),
                        chunk_index=int(item.get("chunk_index", 0)),
                        content=str(item.get("content", "")),
                        section_path=str(item.get("section_path", "")),
                        token_count=int(item.get("token_count", 0)),
                        score=float(item.get("score", 0.0)),
                        rrf_score=float(item.get("rrf_score", item.get("score", 0.0))),
                        vector_rank=item.get("vector_rank"),
                        text_rank=item.get("text_rank"),
                        vector_score=item.get("vector_score"),
                        text_score=item.get("text_score"),
                        metadata=item.get("metadata", {}),
                    )
                )
        else:
            chunks = await self.retriever.retrieve(
                tenant_id=req.tenant_id,
                query=req.question,
                top_k=5,
            )

        # 2. Build system and user prompts
        system_prompt = build_system_prompt(
            tenant_tone=req.role_tone or "helpful, friendly, and concise"
        )
        user_prompt = build_user_prompt(
            question=req.question,
            history=req.history,
            chunks=chunks,
        )

        # 3. LLM Generation with 1-shot repair retry
        answer_result: RagAnswer
        try:
            answer_result, _attempts = await generate_json_with_repair(
                provider=self.provider,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                schema=RagAnswer,
            )
        except Exception as exc:
            logger.error("JSON generation and repair failed completely: %s", str(exc))
            return GenerateAnswerResponse(
                answer=(
                    "I apologize, but I am unable to process your request at this moment. "
                    "Connecting you with a human support agent..."
                ),
                citations=[],
                confidence=0.0,
                should_escalate=True,
                reason="JSON validation failed after repair retry",
                provider=self.provider.name,
                tokens_used=0,
            )

        # 4. Citation verification (T-AI-02)
        valid_citations, citation_error = verify_citations(
            answer_result.citations, chunks
        )
        should_escalate = answer_result.should_escalate or not valid_citations
        escalation_reason = answer_result.reason
        if not valid_citations:
            escalation_reason = citation_error

        # 5. Calibrated confidence calculation (AI-3)
        top_chunk = chunks[0] if chunks else None
        top_score_norm = normalize_top_chunk_score(top_chunk)
        valid_chunk_ids = {c.id for c in chunks}
        citation_cov = (
            calculate_citation_coverage(answer_result.citations, valid_chunk_ids)
            if valid_citations
            else 0.0
        )
        composite_confidence = compute_composite_confidence(
            top_score_norm=top_score_norm,
            citation_coverage=citation_cov,
            self_rating=answer_result.self_rating,
        )

        # 6. Confidence threshold check
        threshold = (
            req.confidence_threshold
            if req.confidence_threshold is not None
            else settings.ai_confidence_threshold
        )
        if composite_confidence < threshold:
            should_escalate = True
            if not escalation_reason or escalation_reason == "Low confidence score":
                escalation_reason = (
                    f"Confidence {composite_confidence:.2f} below threshold {threshold:.2f}"
                )

        final_response = GenerateAnswerResponse(
            answer=answer_result.answer,
            citations=answer_result.citations,
            confidence=composite_confidence,
            should_escalate=should_escalate,
            reason=escalation_reason,
            provider=self.provider.name,
            tokens_used=0,
        )

        # Cache answer if confident and not escalated (AI-7)
        if not should_escalate and composite_confidence >= threshold:
            await self.cache.set(
                tenant_id=req.tenant_id,
                question=req.question,
                response=final_response,
            )

        return final_response
