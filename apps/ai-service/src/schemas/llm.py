"""Pydantic schemas for LLM and RAG interactions."""

from typing import Any

from pydantic import BaseModel, Field


class CitationItem(BaseModel):
    chunk_id: str = Field(description="Unique identifier of cited knowledge chunk")
    doc_id: str = Field(description="Document ID containing chunk")
    title: str = Field(description="Title of source document")


class RagAnswer(BaseModel):
    answer: str = Field(description="Synthesized customer-facing response")
    citations: list[CitationItem] = Field(default_factory=list, description="Citations used")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    should_escalate: bool = Field(
        default=False, description="Flag indicating human agent handoff required"
    )
    reason: str | None = Field(default=None, description="Reason if escalation triggered")


class ChatTurn(BaseModel):
    role: str = Field(description="Sender role: customer | agent | ai | system")
    content: str = Field(description="Message body")


class GenerateAnswerRequest(BaseModel):
    tenant_id: str
    conversation_id: str
    question: str
    history: list[ChatTurn] = Field(default_factory=list)
    retrieved_chunks: list[dict[str, Any]] = Field(default_factory=list)


class GenerateAnswerResponse(BaseModel):
    answer: str
    citations: list[CitationItem]
    confidence: float
    should_escalate: bool
    provider: str
    tokens_used: int = 0
