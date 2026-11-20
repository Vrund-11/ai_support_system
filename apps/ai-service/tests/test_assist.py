"""Tests for Agent Assist: Suggested Reply and Thread Summarization (AI-5, AI-6)."""

import pytest
from fastapi.testclient import TestClient

from src.assist.schemas import AssistMessageItem, SuggestReplyRequest, SummarizeRequest
from src.assist.service import AgentAssistService
from src.ingest.pipeline import IngestionPipeline
from src.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_suggest_reply_with_grounded_citations():
    """Validates that suggest_reply retrieves tenant KB chunks and drafts a grounded answer."""
    pipeline = IngestionPipeline()
    await pipeline.ingest_document(
        tenant_id="tenant_assist_01",
        document_id="doc_billing_kb",
        raw_text="# Billing Policies\nInvoices are billed on the 1st of every month. "
        "Refunds can be requested within 30 days of initial transaction.",
        title="Billing and Refunds Guide",
    )

    service = AgentAssistService()
    req = SuggestReplyRequest(
        tenant_id="tenant_assist_01",
        ticket_subject="Question regarding 30-day refund policy",
        messages=[
            AssistMessageItem(
                sender="customer",
                body="Can I get a refund for my recent annual plan purchase?",
            )
        ],
    )
    res = await service.suggest_reply(req)

    assert res.suggested_reply is not None
    assert len(res.suggested_reply) > 20
    assert res.confidence >= 0.70
    assert len(res.citations) >= 1
    assert any("Billing and Refunds Guide" in c.title for c in res.citations)


@pytest.mark.asyncio
async def test_summarize_thread_sentiment_frustrated():
    """Validates thread summarization and sentiment detection for frustrated customer."""
    service = AgentAssistService()
    req = SummarizeRequest(
        tenant_id="tenant_assist_02",
        ticket_subject="Charged twice for subscription renewal",
        messages=[
            AssistMessageItem(
                sender="customer",
                body="I was charged twice! This is ridiculous, please issue a refund.",
            ),
            AssistMessageItem(
                sender="agent",
                body="I sincerely apologize for the error. Let me check your ledger.",
            ),
            AssistMessageItem(
                sender="customer",
                body="I need this resolved today, very frustrated with this billing issue.",
            ),
        ],
    )
    res = await service.summarize(req)

    assert res.sentiment == "FRUSTRATED"
    assert len(res.summary) > 10
    assert len(res.key_points) >= 2
    assert "Prioritize" in res.recommended_action or "review" in res.recommended_action.lower()


@pytest.mark.asyncio
async def test_summarize_thread_sentiment_positive():
    """Validates thread summarization for resolved/positive conversation."""
    service = AgentAssistService()
    req = SummarizeRequest(
        tenant_id="tenant_assist_03",
        ticket_subject="How to export CSV reports",
        messages=[
            AssistMessageItem(
                sender="customer",
                body="Where can I find the button to export our monthly tickets to CSV?",
            ),
            AssistMessageItem(
                sender="agent",
                body="Under Analytics > Reports, click the Export CSV button in the upper right.",
            ),
            AssistMessageItem(
                sender="customer",
                body="That worked, thanks so much! Perfect help, issue resolved.",
            ),
        ],
    )
    res = await service.summarize(req)

    assert res.sentiment == "POSITIVE"
    assert "resolved" in res.recommended_action.lower() or "close" in res.recommended_action.lower()


def test_api_suggest_reply_endpoint():
    """Validates POST /v1/assist/suggest-reply HTTP endpoint."""
    response = client.post(
        "/v1/assist/suggest-reply",
        json={
            "tenant_id": "tenant_assist_api",
            "ticket_subject": "Need assistance with SSO certificate",
            "messages": [
                {
                    "sender": "customer",
                    "body": "How do I upload an X.509 certificate for Okta SSO?",
                }
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "suggested_reply" in data
    assert data["confidence"] > 0.0
    assert isinstance(data["citations"], list)


def test_api_summarize_endpoint():
    """Validates POST /v1/assist/summarize HTTP endpoint."""
    response = client.post(
        "/v1/assist/summarize",
        json={
            "tenant_id": "tenant_assist_api",
            "ticket_subject": "Account lockout issue",
            "messages": [
                {
                    "sender": "customer",
                    "body": "Our production API keys stopped working unexpectedly.",
                },
                {
                    "sender": "agent",
                    "body": "Checking the rate limit thresholds now.",
                },
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "sentiment" in data
    assert "recommended_action" in data
    assert isinstance(data["key_points"], list)
