"""AWS Lambda handler for signed webhook delivery with SSRF prevention.

Processes SQS events, validates target URLs against private/loopback CIDRs,
signs payload with HMAC-SHA256, and dispatches POST request.
Reports partial batch failures to SQS via batchItemFailures.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import os
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

FORBIDDEN_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),
)


def is_safe_url(url: str, allow_local: bool = False) -> bool:
    """Validate URL scheme is http/https and hostname does not resolve to private/loopback IP."""
    try:
        parsed = urllib.parse.urlparse(url)
    except (ValueError, AttributeError):
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    hostname = parsed.hostname
    if not hostname:
        return False

    # Check for direct local allowance override
    if allow_local or os.environ.get("WEBHOOK_ALLOW_LOCAL", "").lower() in ("1", "true", "yes"):
        return True

    # Block localhost string explicitly
    if hostname.lower() in ("localhost", "localhost.localdomain"):
        return False

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        if not addr_info:
            return False

        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)

            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_unspecified
            ):
                return False

            for net in FORBIDDEN_NETWORKS:
                if ip in net:
                    return False

        return True
    except (OSError, socket.gaierror, ValueError):
        return False


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """HTTP redirect handler strictly disallowing redirects for webhook dispatch to block SSRF bypass."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> Any:
        raise urllib.error.HTTPError(
            req.full_url,
            code,
            f"HTTP redirects disabled for webhook delivery: {newurl}",
            headers,
            fp,
        )


_WEBHOOK_OPENER = urllib.request.build_opener(NoRedirectHandler)


def sign_payload(body: bytes, secret: str) -> str:
    """Compute HMAC-SHA256 hex digest for body bytes."""
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def deliver_record(rec: dict[str, Any], secret: str, timeout: int = 5, allow_local: bool = False) -> None:
    """Validate, sign, and deliver a single webhook record."""
    body_val = rec.get("body", "{}")
    if isinstance(body_val, str):
        msg = json.loads(body_val)
    elif isinstance(body_val, dict):
        msg = body_val
    else:
        raise TypeError(f"Invalid record body type: {type(body_val)}")

    url = msg.get("url") or msg.get("targetUrl")
    if not url:
        raise ValueError(f"Missing url in record {rec.get('messageId')}")

    event_name = msg.get("event")
    if not event_name:
        raise ValueError(f"Missing event in record {rec.get('messageId')}")

    delivery_id = msg.get("deliveryId") or msg.get("eventId") or rec.get("messageId", "del_unknown")
    tenant_id = msg.get("tenantId")
    payload = msg.get("payload", {})

    if not is_safe_url(url, allow_local=allow_local):
        raise ValueError(f"SSRF blocked: URL {url} targets private, loopback, or invalid destination")

    serialized_body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = sign_payload(serialized_body, secret)

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "SupportPilot-Webhook-Dispatcher/1.0",
        "X-SupportPilot-Event": str(event_name),
        "X-SupportPilot-Delivery": str(delivery_id),
        "X-SupportPilot-Signature": f"sha256={signature}",
    }
    if tenant_id:
        headers["X-SupportPilot-Tenant-Id"] = str(tenant_id)

    req = urllib.request.Request(
        url,
        data=serialized_body,
        headers=headers,
        method="POST",
    )

    with _WEBHOOK_OPENER.open(req, timeout=timeout) as response:
        status_code = getattr(response, "status", getattr(response, "code", 200))
        if status_code >= 300:
            raise RuntimeError(f"HTTP response status {status_code}")


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """AWS Lambda handler entry point consuming SQS records."""
    secret = os.environ.get("WEBHOOK_SIGNING_SECRET", "whsec_default_signing_key_32_chars!")
    failures: list[dict[str, str]] = []

    records = event.get("Records", [])
    for rec in records:
        msg_id = rec.get("messageId", "unknown")
        try:
            deliver_record(rec, secret)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to deliver webhook for message %s: %s", msg_id, exc)
            failures.append({"itemIdentifier": msg_id})

    return {"batchItemFailures": failures}
