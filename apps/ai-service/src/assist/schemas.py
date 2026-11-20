"""Pydantic schemas for Agent Assist: Suggested Reply and Summarization (AI-5, AI-6)."""

from pydantic import BaseModel, Field

from src.schemas.llm import CitationItem


class AssistMessageItem(BaseModel):
    """Single chat or ticket message."""

    sender: str = Field(description="Role or sender identifier: customer | agent | ai | system")
    body: str = Field(description="Message body text")
    created_at: str | None = Field(default=None, description="Timestamp or time string")


class SuggestReplyRequest(BaseModel):
    """Payload to request an AI-suggested agent reply."""

    tenant_id: str = Field(description="Tenant scope")
    messages: list[AssistMessageItem] = Field(min_length=1, description="Message thread")
    ticket_subject: str | None = Field(default=None, description="Ticket subject if available")
    ticket_id: str | None = Field(default=None, description="Ticket ID if available")


class SuggestReplyResponse(BaseModel):
    """Draft reply suggested for the human agent."""

    suggested_reply: str = Field(description="Synthesized proposed reply")
    citations: list[CitationItem] = Field(
        default_factory=list, description="Grounding KB citations"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")
    sources: list[str] = Field(default_factory=list, description="Titles of consulted documents")


class SummarizeRequest(BaseModel):
    """Payload to request an AI conversation or ticket summary."""

    tenant_id: str = Field(description="Tenant scope")
    messages: list[AssistMessageItem] = Field(min_length=1, description="Conversation thread")
    ticket_subject: str | None = Field(default=None, description="Ticket subject if available")
    ticket_id: str | None = Field(default=None, description="Ticket ID if available")


class SummarizeResponse(BaseModel):
    """Executive summary of the conversation thread."""

    summary: str = Field(description="2-3 sentence overview of issue and resolution status")
    key_points: list[str] = Field(
        default_factory=list, description="Bulleted key points or customer constraints"
    )
    sentiment: str = Field(
        description="Customer sentiment: POSITIVE | NEUTRAL | FRUSTRATED | URGENT"
    )
    recommended_action: str = Field(description="Next concrete operational step for the agent")
