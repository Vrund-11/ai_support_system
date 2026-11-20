"""Tests for Ticket Classifier (AI-4): ML inference, rules fallback, and feedback."""

from fastapi.testclient import TestClient

from src.classifier.rules import classify_by_rules
from src.classifier.schemas import ClassifierFeedbackRequest
from src.classifier.service import ClassifierService
from src.main import app

client = TestClient(app)


def test_rules_fallback_urgent_outage():
    """Validates that outage and down keywords trigger URGENT priority and bug category."""
    res = classify_by_rules("Production database down, major outage affecting all users")
    assert res.priority == "URGENT"
    assert res.category == "bug"
    assert res.confidence >= 0.70
    assert any("outage" in r or "down" in r for r in res.matched_rules)


def test_rules_fallback_high_billing_refund():
    """Validates that refund and charged twice trigger HIGH priority and billing category."""
    res = classify_by_rules("I was charged twice on my invoice. Need an immediate refund.")
    assert res.priority == "HIGH"
    assert res.category == "billing"
    assert res.confidence >= 0.70


def test_rules_fallback_how_to():
    """Validates how-to question classification."""
    res = classify_by_rules("How do I configure webhook signatures for my tenant?")
    assert res.category == "how-to"
    assert res.priority in {"LOW", "MEDIUM"}


def test_rules_fallback_account_lockout():
    """Validates account lockout classification."""
    res = classify_by_rules("Locked out of account, lost 2FA phone device")
    assert res.category == "account"
    assert res.priority == "HIGH"


def test_rules_fallback_feature_request():
    """Validates feature request classification."""
    res = classify_by_rules("Feature request: please add dark mode support to the chat widget")
    assert res.category == "feature request"


def test_classifier_service_with_trained_model():
    """Validates end-to-end ML inference with the exported joblib model."""
    service = ClassifierService()
    assert service.load_model() is True

    res = service.classify(
        subject="Payment processor down, all cards failing",
        description="Checkout returning 500 error on Stripe gateway",
    )
    assert res.priority in {"HIGH", "URGENT"}
    assert res.category in {"billing", "bug"}
    assert res.provider == "model"
    assert res.confidence > 0.20
    assert res.probabilities is not None
    assert "priority_URGENT" in res.probabilities or "priority_HIGH" in res.probabilities


def test_classifier_service_fallback_on_missing_model(tmp_path):
    """Validates graceful fallback to rules when model artifact does not exist."""
    fake_path = tmp_path / "non_existent_model.joblib"
    service = ClassifierService(model_path=fake_path)

    res = service.classify(
        subject="Emergency outage: API server crashed",
        description="Workers OOM killed",
    )
    assert res.provider == "rules"
    assert res.priority == "URGENT"
    assert res.category == "bug"


def test_classifier_feedback_recording():
    """Validates recording of agent corrections for drift tracking."""
    service = ClassifierService()
    req = ClassifierFeedbackRequest(
        ticket_id="TKT-101",
        predicted_priority="MEDIUM",
        actual_priority="HIGH",
        predicted_category="bug",
        actual_category="billing",
        notes="Dispute over invoice line item",
    )
    res = service.record_feedback(req)
    assert res.status == "recorded"
    assert res.priority_match is False
    assert res.category_match is False

    records = service.get_feedback_records()
    assert len(records) >= 1
    assert records[-1]["ticket_id"] == "TKT-101"


def test_api_classify_endpoint_success():
    """Validates POST /v1/classify HTTP endpoint."""
    response = client.post(
        "/v1/classify",
        json={
            "subject": "Double charged for monthly subscription",
            "description": "Please issue refund for second charge",
            "tenant_id": "tenant_123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "billing"
    assert data["priority"] in {"HIGH", "URGENT", "MEDIUM"}
    assert data["confidence"] > 0.0
    assert data["provider"] in {"model", "rules"}


def test_api_classify_feedback_endpoint_success():
    """Validates POST /v1/classify/feedback HTTP endpoint."""
    response = client.post(
        "/v1/classify/feedback",
        json={
            "ticket_id": "TKT-555",
            "predicted_priority": "URGENT",
            "actual_priority": "URGENT",
            "predicted_category": "bug",
            "actual_category": "bug",
            "tenant_id": "tenant_123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recorded"
    assert data["priority_match"] is True
    assert data["category_match"] is True
