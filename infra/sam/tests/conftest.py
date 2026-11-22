"""Pytest configuration and fixtures for SAM webhook tests."""

from __future__ import annotations

import http.server
import json
import sys
import threading
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class CaseInsensitiveDict(dict):
    """Case-insensitive dictionary for HTTP header assertions."""

    def __getitem__(self, key: str) -> Any:
        for k, v in self.items():
            if k.lower() == key.lower():
                return v
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        for k, v in self.items():
            if k.lower() == key.lower():
                return v
        return default

    def __contains__(self, key: object) -> bool:
        if isinstance(key, str):
            return any(k.lower() == key.lower() for k in self.keys())
        return False


class WebhookReceiverHandler(http.server.BaseHTTPRequestHandler):
    """Test HTTP handler that records requests and returns configured status."""

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress standard logging."""

    def do_POST(self) -> None:
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Store received request in server object with case-insensitive headers
        headers_dict = CaseInsensitiveDict(self.headers.items())
        record = {
            "path": self.path,
            "headers": headers_dict,
            "body": body,
            "json": json.loads(body.decode("utf-8")) if body else None,
        }
        self.server.received_requests.append(record)  # type: ignore[attr-defined]

        status_code = getattr(self.server, "next_status_code", 200)
        self.send_response(status_code)
        location = getattr(self.server, "next_location", None)
        if location:
            self.send_header("Location", location)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        response_body = json.dumps({"status": "ok" if status_code < 300 else "error"}).encode("utf-8")
        self.wfile.write(response_body)


class MockWebhookServer(http.server.HTTPServer):
    """HTTPServer with state tracking for testing."""

    def __init__(self, host: str = "127.0.0.1", port: int = 0):
        super().__init__((host, port), WebhookReceiverHandler)
        self.received_requests: list[dict[str, Any]] = []
        self.next_status_code: int = 200
        self.next_location: str | None = None


@pytest.fixture
def mock_webhook_server() -> Generator[MockWebhookServer, None, None]:
    """Start an ephemeral HTTP server in background thread for webhook delivery tests."""
    server = MockWebhookServer()
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    yield server

    server.shutdown()
    server.server_close()
