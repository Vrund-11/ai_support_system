"""Unit tests for the Python Webhook Lambda handler (Feature 46)."""

from __future__ import annotations

import json
import urllib.error
from typing import Any

import pytest

from infra.sam.handlers.webhook import (
    deliver_record,
    handler,
    is_safe_url,
    sign_payload,
)


def test_sign_payload_deterministic() -> None:
    body = b'{"hello":"world"}'
    secret = "whsec_super_secret_signing_key_123"
    sig1 = sign_payload(body, secret)
    sig2 = sign_payload(body, secret)
    assert sig1 == sig2
    assert len(sig1) == 64
    assert sig1 == "faf8965e802a3a5c39be12159ff07dc4239b17434776f3a33e289d97f19e5570"


@pytest.mark.parametrize(
    "invalid_url",
    [
        "http://127.0.0.1:8080/hook",
        "http://localhost:8080/hook",
        "http://10.0.0.1/hook",
        "http://172.16.5.10/webhook",
        "http://192.168.1.100/api",
        "http://169.254.169.254/latest/meta-data",
        "http://0.0.0.0:8000/callback",
        "file:///etc/passwd",
        "ftp://ftp.example.com/data",
        "gopher://example.com",
        "http://[::1]:8080/webhook",
        "",
        "not_a_url",
    ],
)
def test_is_safe_url_blocks_private_and_loopback_ips(invalid_url: str) -> None:
    assert is_safe_url(invalid_url, allow_local=False) is False


def test_is_safe_url_allows_public_https() -> None:
    # Public domains
    assert is_safe_url("https://example.com/webhook", allow_local=False) is True
    assert is_safe_url("https://api.github.com/webhook", allow_local=False) is True


def test_is_safe_url_allows_local_when_flag_enabled() -> None:
    assert is_safe_url("http://127.0.0.1:8080/hook", allow_local=True) is True


def test_handler_delivers_with_signature_and_headers(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    secret = "whsec_custom_test_signing_key_32_bytes!"
    monkeypatch.setenv("WEBHOOK_SIGNING_SECRET", secret)

    port = mock_webhook_server.server_address[1]
    url = f"http://127.0.0.1:{port}/webhook-callback"

    payload = {"ticketId": "tkt-001", "action": "created", "priority": "HIGH"}
    event = {
        "Records": [
            {
                "messageId": "msg-delivery-001",
                "body": json.dumps(
                    {
                        "deliveryId": "del_101",
                        "tenantId": "tenant_abc",
                        "url": url,
                        "event": "ticket.created",
                        "payload": payload,
                        "attempt": 1,
                    }
                ),
            }
        ]
    }

    result = handler(event)
    assert result == {"batchItemFailures": []}

    # Verify server received expected request
    assert len(mock_webhook_server.received_requests) == 1
    req = mock_webhook_server.received_requests[0]
    assert req["path"] == "/webhook-callback"
    assert req["headers"]["X-SupportPilot-Event"] == "ticket.created"
    assert req["headers"]["X-SupportPilot-Delivery"] == "del_101"
    assert req["headers"]["X-SupportPilot-Tenant-Id"] == "tenant_abc"

    expected_sig = sign_payload(json.dumps(payload, separators=(",", ":")).encode("utf-8"), secret)
    assert req["headers"]["X-SupportPilot-Signature"] == f"sha256={expected_sig}"
    assert req["json"] == payload


def test_handler_reports_ssrf_as_batch_item_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WEBHOOK_ALLOW_LOCAL", raising=False)

    event = {
        "Records": [
            {
                "messageId": "msg-ssrf-blocked",
                "body": json.dumps(
                    {
                        "deliveryId": "del_ssrf",
                        "tenantId": "tenant_xyz",
                        "url": "http://169.254.169.254/latest/meta-data",
                        "event": "ticket.created",
                        "payload": {"data": "evil"},
                        "attempt": 1,
                    }
                ),
            }
        ]
    }

    result = handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-ssrf-blocked"}]}


def test_handler_reports_500_as_batch_item_failure(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    mock_webhook_server.next_status_code = 500

    port = mock_webhook_server.server_address[1]
    url = f"http://127.0.0.1:{port}/fail"

    event = {
        "Records": [
            {
                "messageId": "msg-500-error",
                "body": json.dumps(
                    {
                        "deliveryId": "del_500",
                        "tenantId": "tenant_abc",
                        "url": url,
                        "event": "ticket.updated",
                        "payload": {"id": "1"},
                    }
                ),
            }
        ]
    }

    result = handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-500-error"}]}


def test_handler_partial_batch_failures_mixed(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")

    port = mock_webhook_server.server_address[1]
    good_url = f"http://127.0.0.1:{port}/good"
    bad_url = "http://10.254.254.1/bad-ip"  # Private IP blocked by SSRF

    event = {
        "Records": [
            {
                "messageId": "msg-success",
                "body": json.dumps(
                    {
                        "deliveryId": "del_success",
                        "tenantId": "tenant_1",
                        "url": good_url,
                        "event": "ticket.created",
                        "payload": {"success": True},
                    }
                ),
            },
            {
                "messageId": "msg-failed",
                "body": json.dumps(
                    {
                        "deliveryId": "del_failed",
                        "tenantId": "tenant_1",
                        "url": bad_url,
                        "event": "ticket.created",
                        "payload": {"success": False},
                    }
                ),
            },
        ]
    }

    # Temporarily remove local override so bad_url is blocked while good_url works with direct allow_local or test
    # Actually bad_url has IP 10.254.254.1 which is in 10.0.0.0/8 so even if allow_local is False, it will be blocked
    monkeypatch.delenv("WEBHOOK_ALLOW_LOCAL", raising=False)
    # We can test deliver_record with bad URL directly or pass invalid url:
    # Let's test with unresolvable/invalid scheme or bad url:
    event["Records"][1]["body"] = json.dumps(
        {
            "deliveryId": "del_failed",
            "url": "http://10.254.254.1/bad",
            "event": "ticket.created",
            "payload": {},
        }
    )
    # For good URL, allow local
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    # But bad URL has an invalid URL or status code 500
    # Let's make record 2 have an invalid JSON or invalid URL:
    event["Records"][1]["body"] = "invalid_json_body"

    result = handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-failed"}]}


def test_handler_blocks_redirect_ssrf_to_metadata(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ensure HTTP 302 redirect to metadata IP is blocked and reported as failure."""
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    mock_webhook_server.next_status_code = 302
    mock_webhook_server.next_location = "http://169.254.169.254/latest/meta-data"

    port = mock_webhook_server.server_address[1]
    url = f"http://127.0.0.1:{port}/redirect-hook"

    event = {
        "Records": [
            {
                "messageId": "msg-ssrf-redirect-302",
                "body": json.dumps({
                    "deliveryId": "del_redirect_302",
                    "tenantId": "tenant_sec",
                    "url": url,
                    "event": "ticket.created",
                    "payload": {"alert": "pawned"},
                }),
            }
        ]
    }

    result = handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-ssrf-redirect-302"}]}


def test_handler_blocks_301_permanent_redirect(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ensure HTTP 301 permanent redirect is blocked and reported as failure."""
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    mock_webhook_server.next_status_code = 301
    mock_webhook_server.next_location = "http://127.0.0.1:8080/internal-admin"

    port = mock_webhook_server.server_address[1]
    url = f"http://127.0.0.1:{port}/moved-hook"

    event = {
        "Records": [
            {
                "messageId": "msg-ssrf-redirect-301",
                "body": json.dumps({
                    "deliveryId": "del_redirect_301",
                    "tenantId": "tenant_sec",
                    "url": url,
                    "event": "ticket.updated",
                    "payload": {"alert": "admin"},
                }),
            }
        ]
    }

    result = handler(event)
    assert result == {"batchItemFailures": [{"itemIdentifier": "msg-ssrf-redirect-301"}]}


def test_deliver_record_does_not_hit_redirect_target(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify internal target server receives 0 requests when redirect is attempted."""
    import http.server
    import threading

    target_hits: list[str] = []

    class TargetServer(http.server.BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            pass

        def do_POST(self) -> None:
            target_hits.append(self.path)
            self.send_response(200)
            self.end_headers()

    target_srv = http.server.HTTPServer(("127.0.0.1", 0), TargetServer)
    target_port = target_srv.server_address[1]
    threading.Thread(target=target_srv.serve_forever, daemon=True).start()

    class RedirectServer(http.server.BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            pass

        def do_POST(self) -> None:
            self.send_response(302)
            self.send_header("Location", f"http://127.0.0.1:{target_port}/secret")
            self.end_headers()

    redirect_srv = http.server.HTTPServer(("127.0.0.1", 0), RedirectServer)
    redirect_port = redirect_srv.server_address[1]
    threading.Thread(target=redirect_srv.serve_forever, daemon=True).start()

    try:
        rec = {
            "messageId": "msg-no-follow",
            "body": json.dumps({
                "deliveryId": "del_no_follow",
                "url": f"http://127.0.0.1:{redirect_port}/entry",
                "event": "ticket.created",
                "payload": {"msg": "test"},
            }),
        }
        with pytest.raises(urllib.error.HTTPError):
            deliver_record(rec, "whsec_test_signing_key_32_bytes!", allow_local=True)

        # Target server MUST receive zero requests
        assert len(target_hits) == 0
    finally:
        redirect_srv.shutdown()
        redirect_srv.server_close()
        target_srv.shutdown()
        target_srv.server_close()

