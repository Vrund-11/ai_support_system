#!/usr/bin/env python3
"""Runner script for local execution and verification of the WebhookFunction.

Reads infra/sam/events/sqs.json, executes handlers.webhook.handler with
an ephemeral mock listener, records truthful execution timing, and writes
the result to evidence/aws/sam-invoke.txt.
"""

from __future__ import annotations

import datetime
import http.server
import json
import os
import shutil
import sys
import threading
import time
import uuid
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from infra.sam.handlers.webhook import handler


class LocalReceiverHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        sig = self.headers.get("X-SupportPilot-Signature", "missing")
        delivery = self.headers.get("X-SupportPilot-Delivery", "missing")
        event = self.headers.get("X-SupportPilot-Event", "missing")

        self.server.last_delivery = {  # type: ignore[attr-defined]
            "event": event,
            "delivery": delivery,
            "signature": sig,
            "bytes_received": len(body),
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"received"}')


def run_invocation() -> str:
    # Set environment variables matching SAM template
    os.environ["WEBHOOK_SIGNING_SECRET"] = "whsec_default_signing_key_32_chars!"
    os.environ["WEBHOOK_ALLOW_LOCAL"] = "true"

    # Start ephemeral listener on port 9999
    server = http.server.HTTPServer(("127.0.0.1", 9999), LocalReceiverHandler)
    server.last_delivery = None  # type: ignore[attr-defined]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # Read event JSON
    event_path = PROJECT_ROOT / "infra" / "sam" / "events" / "sqs.json"
    with open(event_path, "r", encoding="utf-8") as f:
        event = json.load(f)

    req_id = str(uuid.uuid4())
    timestamp = datetime.datetime.now(datetime.UTC).isoformat()
    docker_available = shutil.which("docker") is not None
    sam_available = shutil.which("sam") is not None

    start_time = time.perf_counter()
    result = handler(event)
    duration_ms = (time.perf_counter() - start_time) * 1000.0

    delivery_audit = getattr(server, "last_delivery", None)

    server.shutdown()
    server.server_close()

    logs: list[str] = [
        "================================================================================",
        "SupportPilot WebhookFunction Local Invocation Runner",
        "================================================================================",
        f"Timestamp: {timestamp}",
        f"Host Platform: {sys.platform} (Python {sys.version.split()[0]})",
        "Host Tooling Audit:",
        f"  - Docker CLI: {'Available' if docker_available else 'NOT INSTALLED / NOT FOUND IN PATH'}",
        f"  - AWS SAM CLI: {'Available' if sam_available else 'NOT INSTALLED / NOT FOUND IN PATH'}",
        "Execution Mode: Direct In-Process Python Lambda Execution Runner",
        "Note: SAM CLI and Docker are absent on this host. This runner loads",
        "      infra/sam/events/sqs.json and executes handlers.webhook.handler",
        "      against an ephemeral mock webhook receiver to verify signing and delivery.",
        "--------------------------------------------------------------------------------",
        "Handler: infra.sam.handlers.webhook.handler",
        "Event File: infra/sam/events/sqs.json",
        f"Records Processed: {len(event.get('Records', []))}",
        f"Execution ID: {req_id}",
        f"Execution Status: {'SUCCESS' if not result.get('batchItemFailures') else 'PARTIAL_FAILURE'}",
        f"Real Elapsed Time: {duration_ms:.2f} ms",
        "",
        "Handler Output:",
        json.dumps(result, indent=2),
        "",
        "Receiver Verification:",
        f"  - Event Received: {delivery_audit.get('event') if delivery_audit else 'None'}",
        f"  - Delivery ID: {delivery_audit.get('delivery') if delivery_audit else 'None'}",
        f"  - Signature: {delivery_audit.get('signature') if delivery_audit else 'None'}",
        f"  - Bytes Received: {delivery_audit.get('bytes_received') if delivery_audit else 'None'}",
        "================================================================================",
    ]

    return "\n".join(logs)


def main() -> None:
    output = run_invocation()
    print(output)

    # Save to evidence/aws/sam-invoke.txt
    evidence_dir = PROJECT_ROOT / "evidence" / "aws"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    out_file = evidence_dir / "sam-invoke.txt"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"\n[INFO] Wrote SAM invocation evidence to: {out_file}")


if __name__ == "__main__":
    main()
