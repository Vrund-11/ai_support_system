"""Pydantic schemas for SupportPilot Ticket Classifier (AI-4)."""

from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    """Input ticket payload to classify."""

    subject: str = Field(description="Ticket subject or headline")
    description: str | None = Field(default=None, description="Ticket body description")
    first_message: str | None = Field(
        default=None, description="Customer initial message if separate"
    )
    tenant_id: str | None = Field(default=None, description="Tenant scope if available")


class ClassifyResponse(BaseModel):
    """Predicted priority and category with confidence and provider provenance."""

    priority: str = Field(description="Predicted priority: LOW, MEDIUM, HIGH, URGENT")
    category: str = Field(
        description="Predicted category: billing, bug, how-to, account, feature request, other"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Calibrated prediction confidence")
    provider: str = Field(description="'model' or 'rules'")
    probabilities: dict[str, float] | None = Field(
        default=None, description="Class probability distribution"
    )


class ClassifierFeedbackRequest(BaseModel):
    """Agent correction feedback for model monitoring and drift tracking."""

    ticket_id: str = Field(description="Ticket identifier")
    predicted_priority: str
    actual_priority: str
    predicted_category: str
    actual_category: str
    tenant_id: str | None = None
    agent_id: str | None = None
    notes: str | None = None


class ClassifierFeedbackResponse(BaseModel):
    status: str = "recorded"
    ticket_id: str
    priority_match: bool
    category_match: bool
