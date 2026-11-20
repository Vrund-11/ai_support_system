"""Tests for ai-service test and diagnostic API endpoints."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_get_provider_info():
    response = client.get("/v1/provider")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert data["embedding_dim"] == 384
    assert data["confidence_threshold"] == 0.55


def test_post_test_generate():
    response = client.post(
        "/v1/test/generate",
        json={"user_prompt": "Hello SupportPilot AI"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert len(data["response"]) > 0


def test_post_test_answer():
    response = client.post(
        "/v1/test/answer",
        json={"user_prompt": "How do I upgrade to Pro plan?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "citations" in data
    assert "confidence" in data
    assert "should_escalate" in data
    assert data["confidence"] > 0.0


def test_post_test_embed():
    response = client.post(
        "/v1/test/embed",
        json={"texts": ["Text sentence one", "Text sentence two"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    assert data["dimensions"] == 384
    assert len(data["embeddings"]) == 2
    assert len(data["embeddings"][0]) == 384
