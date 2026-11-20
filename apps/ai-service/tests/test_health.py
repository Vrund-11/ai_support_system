"""Tests for ai-service health and readiness endpoints."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_ready():
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["service"] == "ai-service"
    assert "database" in data
    assert "redis" in data


def test_readyz():
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
