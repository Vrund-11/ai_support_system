"""Tests for ai-service health and readiness endpoints."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from src.config import settings
from src.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok"}
    assert "service" not in data
    assert "environment" not in data


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@patch("src.main.check_redis_connection", new_callable=AsyncMock)
@patch("src.main.check_db_connection", new_callable=AsyncMock)
def test_ready_unauthenticated_healthy(mock_db, mock_redis):
    mock_db.return_value = {"status": "connected"}
    mock_redis.return_value = {"status": "connected"}

    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ready"}
    assert "database" not in data
    assert "redis" not in data
    assert "service" not in data
    assert "dependencies" not in data


@patch("src.main.check_redis_connection", new_callable=AsyncMock)
@patch("src.main.check_db_connection", new_callable=AsyncMock)
def test_ready_unauthenticated_unhealthy(mock_db, mock_redis):
    mock_db.return_value = {"status": "disconnected"}
    mock_redis.return_value = {"status": "connected"}

    response = client.get("/ready")
    assert response.status_code == 503
    data = response.json()
    assert data == {"status": "not_ready"}
    assert "database" not in data
    assert "redis" not in data
    assert "dependencies" not in data


@patch("src.main.check_redis_connection", new_callable=AsyncMock)
@patch("src.main.check_db_connection", new_callable=AsyncMock)
def test_ready_authenticated_healthy(mock_db, mock_redis):
    mock_db.return_value = {"status": "connected"}
    mock_redis.return_value = {"status": "connected"}

    token = settings.internal_service_token or settings.service_token
    response = client.get("/ready", headers={"x-service-token": token})
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ready",
        "dependencies": {
            "database": "connected",
            "redis": "connected",
        },
    }


@patch("src.main.check_redis_connection", new_callable=AsyncMock)
@patch("src.main.check_db_connection", new_callable=AsyncMock)
def test_ready_authenticated_unhealthy(mock_db, mock_redis):
    mock_db.return_value = {"status": "connected"}
    mock_redis.return_value = {"status": "disconnected"}

    token = settings.internal_service_token or settings.service_token
    response = client.get("/ready", headers={"x-service-token": token})
    assert response.status_code == 503
    data = response.json()
    assert data == {
        "status": "not_ready",
        "dependencies": {
            "database": "connected",
            "redis": "disconnected",
        },
    }


@patch("src.main.check_redis_connection", new_callable=AsyncMock)
@patch("src.main.check_db_connection", new_callable=AsyncMock)
def test_health_readiness_alias(mock_db, mock_redis):
    mock_db.return_value = {"status": "connected"}
    mock_redis.return_value = {"status": "connected"}

    response = client.get("/health/readiness")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
