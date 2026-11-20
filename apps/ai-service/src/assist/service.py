"""Agent Assist service: Suggested Replies and Thread Summarization (AI-5, AI-6)."""

import logging

from src.assist.schemas import (
    SuggestReplyRequest,
    SuggestReplyResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from src.providers.factory import get_llm_provider
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import CitationItem

logger = logging.getLogger(__name__)


class AgentAssistService:
    """Provides AI copilot assistance for human agents."""

    async def suggest_reply(self, request: SuggestReplyRequest) -> SuggestReplyResponse:
        """Drafts a grounded suggested reply for the agent using the conversation and tenant KB."""
        # 1. Identify customer query
        customer_msg = None
        for m in reversed(request.messages):
            if m.sender.lower() in {"customer", "user", "visitor"}:
                customer_msg = m.body
                break
        if not customer_msg and request.messages:
            customer_msg = request.messages[-1].body
        if not customer_msg:
            customer_msg = request.ticket_subject or "Support assistance request"

        search_query = f"{request.ticket_subject or ''} {customer_msg}".strip()

        # 2. Retrieve relevant KB chunks
        retriever = HybridRetriever()
        chunks = await retriever.retrieve(
            tenant_id=request.tenant_id,
            query=search_query,
            top_k=3,
        )

        citations: list[CitationItem] = []
        sources: list[str] = []
        doc_cache: dict[str, str] = {}
        for c in chunks:
            if c.document_id not in doc_cache:
                doc = await retriever.repo.get_document(request.tenant_id, c.document_id)
                doc_cache[c.document_id] = doc.title if doc else ""
            title = doc_cache[c.document_id] or c.section_path or "Knowledge Base"
            citations.append(CitationItem(chunk_id=c.id, doc_id=c.document_id, title=title))
            if title not in sources:
                sources.append(title)

        # 3. Draft Suggested Reply
        provider = get_llm_provider()
        context_str = "\n".join(
            f"[{c.metadata.get('title') or c.section_path or 'Document'}]: {c.content}"
            for c in chunks
        )

        system_prompt = (
            "You are an AI Copilot assisting a customer support agent. "
            "Draft a helpful, polite, and professional response that the human "
            "agent can send to the customer. "
            "Ground your answer solely on the provided knowledge base context."
        )
        user_prompt = (
            f"Ticket Subject: {request.ticket_subject or 'N/A'}\n"
            f"Customer Message: {customer_msg}\n"
            f"Knowledge Base Context:\n{context_str}\n\n"
            "Draft suggested agent reply:"
        )

        try:
            suggested_text = await provider.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
            )
        except Exception as exc:
            logger.warning("LLM provider generation failed (%s); using heuristic fallback", exc)
            if chunks:
                doc_title = citations[0].title if citations else "Knowledge Base"
                suggested_text = (
                    f"Hello, based on our {doc_title} documentation, "
                    f"{chunks[0].content[:220].strip()}... "
                    "Please let me know if you would like me to assist further."
                )
            else:
                suggested_text = (
                    "Hello, thank you for reaching out. I am looking into this issue for you "
                    "and will follow up shortly with resolution details."
                )

        confidence = 0.90 if chunks else 0.70

        return SuggestReplyResponse(
            suggested_reply=suggested_text,
            citations=citations,
            confidence=confidence,
            sources=sources,
        )

    async def summarize(self, request: SummarizeRequest) -> SummarizeResponse:
        """Generates an executive summary of the conversation thread for handoff or closure."""
        # Build chronological text representation
        lines = []
        for m in request.messages:
            lines.append(f"[{m.sender.upper()}]: {m.body}")
        thread_text = "\n".join(lines)

        # Sentiment heuristics
        lower_thread = thread_text.lower()
        if any(w in lower_thread for w in ["outage", "emergency", "breach", "critical", "down"]):
            sentiment = "URGENT"
        elif any(
            w in lower_thread
            for w in ["frustrated", "disappointed", "angry", "terrible", "charged twice", "refund"]
        ):
            sentiment = "FRUSTRATED"
        elif any(
            w in lower_thread
            for w in ["thanks", "thank you", "great", "awesome", "perfect", "resolved", "solved"]
        ):
            sentiment = "POSITIVE"
        else:
            sentiment = "NEUTRAL"

        provider = get_llm_provider()
        system_prompt = (
            "You are an AI assistant summarizing support conversations. "
            "Provide a concise 2-sentence summary, 2-3 key takeaway bullet points, "
            "and one recommended next action."
        )
        user_prompt = (
            f"Ticket Subject: {request.ticket_subject or 'N/A'}\n"
            f"Conversation Thread:\n{thread_text}\n\n"
            "Summarize the conversation:"
        )

        try:
            raw_summary = await provider.generate_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
            )
            summary_sentences = [s.strip() for s in raw_summary.split("\n") if s.strip()]
            summary = summary_sentences[0] if summary_sentences else raw_summary
        except Exception as exc:
            logger.warning("LLM provider summarization failed (%s); using heuristic fallback", exc)
            first_msg = request.messages[0].body if request.messages else "Customer initiated chat."
            last_msg = request.messages[-1].body if request.messages else "Pending agent response."
            summary = (
                f"Customer inquired regarding '{request.ticket_subject or first_msg[:50]}'. "
                f"Most recent update: {last_msg[:80]}."
            )

        key_points = [
            f"Customer initial inquiry: {request.messages[0].body[:70]}...",
            f"Total thread messages: {len(request.messages)} exchanges.",
            f"Detected customer sentiment: {sentiment}.",
        ]

        if sentiment in {"URGENT", "FRUSTRATED"}:
            recommended_action = (
                "Prioritize immediate human agent review and acknowledge customer frustration."
            )
        elif sentiment == "POSITIVE":
            recommended_action = (
                "Verify customer has no further inquiries and mark ticket resolved."
            )
        else:
            recommended_action = "Provide requested documentation and verify issue resolution."

        return SummarizeResponse(
            summary=summary,
            key_points=key_points,
            sentiment=sentiment,
            recommended_action=recommended_action,
        )


_global_assist_service: AgentAssistService | None = None


def get_agent_assist_service() -> AgentAssistService:
    global _global_assist_service
    if _global_assist_service is None:
        _global_assist_service = AgentAssistService()
    return _global_assist_service
