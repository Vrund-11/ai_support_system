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
    confidence: float = Field(
        default=0.85, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0"
    )
    self_rating: float = Field(
        default=0.85, ge=0.0, le=1.0, description="Model self-assessed certainty"
    )
    should_escalate: bool = Field(
        default=False, description="Flag indicating human agent handoff required"
    )
    reason: str | None = Field(default=None, description="Reason if escalation triggered")


class ChatTurn(BaseModel):
    role: str = Field(description="Sender role: customer | agent | ai | system")
    content: str = Field(description="Message body")


class GenerateAnswerRequest(BaseModel):
    tenant_id: str = Field(default="507f1f77bcf86cd799439011", description="Tenant ID")
    conversation_id: str | None = None
    question: str
    history: list[ChatTurn] = Field(default_factory=list)
    retrieved_chunks: list[dict[str, Any]] = Field(default_factory=list)
    role_tone: str | None = Field(
        default="helpful, friendly, and concise", description="Brand voice/tone"
    )
    confidence_threshold: float | None = Field(
        default=None, description="Per-tenant confidence threshold overriding default"
    )


class GenerateAnswerResponse(BaseModel):
    answer: str
    citations: list[CitationItem]
    confidence: float
    should_escalate: bool
    reason: str | None = None
    provider: str
    tokens_used: int = 0
    quota_exceeded: bool = False
