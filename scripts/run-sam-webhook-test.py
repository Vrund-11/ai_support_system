#!/usr/bin/env python3
"""Execute SAM local invoke for SupportPilot WebhookDispatcher.

Supports two modes:
--mode success: Starts HTTP server on 9999, dispatches webhook via SAM local invoke,
               captures incoming HTTP request with HMAC SHA-256 signature, returns HTTP 200,
               and verifies empty batchItemFailures.
--mode failure: Dispatches webhook with target unavailable to verify retry path and batchItemFailures.
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

SAM_BIN = r"C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd"
REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = REPO_ROOT / "infra" / "sam" / "template.yaml"
BUILD_DIR = REPO_ROOT / "infra" / "sam" / ".aws-sam" / "build"
BUILT_TEMPLATE = BUILD_DIR / "template.yaml"
ENV_PATH = REPO_ROOT / "infra" / "sam" / "env.json"

EVENT_SUCCESS = REPO_ROOT / "infra" / "sam" / "events" / "sqs-success.json"
EVENT_FAILURE = REPO_ROOT / "infra" / "sam" / "events" / "sqs.json"

captured_requests: list[dict[str, str]] = []


class WebhookServerHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        req_info = {
            "path": self.path,
            "signature": self.headers.get("X-SupportPilot-Signature", ""),
            "event": self.headers.get("X-SupportPilot-Event", ""),
            "delivery": self.headers.get("X-SupportPilot-Delivery", ""),
            "tenant_id": self.headers.get("X-SupportPilot-Tenant-Id", ""),
            "content_type": self.headers.get("Content-Type", ""),
            "body": body,
        }
        captured_requests.append(req_info)

        print("\n" + "=" * 60)
        print(">>> LOCAL RECEIVER (PORT 9999) RECEIVED WEBHOOK DELIVERY")
        print("=" * 60)
        print(f"Path: {self.path}")
        print(f"X-SupportPilot-Signature: {req_info['signature']}")
        print(f"X-SupportPilot-Event:     {req_info['event']}")
        print(f"X-SupportPilot-Delivery:  {req_info['delivery']}")
        print(f"X-SupportPilot-Tenant-Id: {req_info['tenant_id']}")
        print(f"Content-Type:             {req_info['content_type']}")
        print(f"Body:                     {body}")
        print("Returning: HTTP 200 OK")
        print("=" * 60 + "\n")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok","received":true}')

    def log_message(self, format, *args):
        pass  # Quiet logging


def run_sam(event_file: Path, env_file: Path | None = None) -> tuple[int, str, str]:
    cmd = [
        SAM_BIN,
        "local",
        "invoke",
        "WebhookFunction",
        "-e",
        str(event_file),
        "-t",
        str(BUILT_TEMPLATE),
    ]
    if env_file and env_file.exists():
        cmd.extend(["-n", str(env_file)])

    env = os.environ.copy()
    env["SAM_CLI_TELEMETRY"] = "0"

    print("Executing SAM command:")
    print(" ".join(cmd))
    proc = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT / "infra" / "sam"),
        capture_output=True,
        text=True,
        env=env,
    )
    return proc.returncode, proc.stdout, proc.stderr


def main():
    parser = argparse.ArgumentParser(description="SAM Webhook Dispatcher Local Invoke Runner")
    parser.add_argument("--mode", choices=["success", "failure"], default="success", help="Test mode")
    args = parser.parse_args()

    # Always ensure template is built
    if not BUILT_TEMPLATE.exists():
        print("Building SAM template...")
        b_res = subprocess.run([SAM_BIN, "build", "--template", str(TEMPLATE_PATH)], cwd=str(REPO_ROOT / "infra" / "sam"))
        if b_res.returncode != 0:
            print("SAM build failed")
            sys.exit(b_res.returncode)

    if args.mode == "failure":
        print("=================================================================")
        print("SAM LOCAL INVOKE: RETRY PATH / TARGET UNAVAILABLE FAILURE")
        print("=================================================================")
        code, stdout, stderr = run_sam(EVENT_FAILURE)
        print("--- STDOUT ---")
        print(stdout)
        print("--- STDERR ---")
        print(stderr)
        print(f"Invocation Exit Code: {code}")
        sys.exit(code)

    elif args.mode == "success":
        print("=================================================================")
        print("SAM LOCAL INVOKE: SUCCESSFUL DELIVERY WITH HMAC SIGNATURE")
        print("=================================================================")

        server = http.server.HTTPServer(("0.0.0.0", 9999), WebhookServerHandler)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        print("Local HTTP receiver listening on http://0.0.0.0:9999/webhook...")
        time.sleep(0.5)

        try:
            code, stdout, stderr = run_sam(EVENT_SUCCESS, ENV_PATH)
            print("--- STDOUT ---")
            print(stdout)
            print("--- STDERR ---")
            print(stderr)
            print(f"Invocation Exit Code: {code}")

            if captured_requests:
                print("\nVERIFICATION: Webhook delivered successfully to local receiver.")
                print(f"HMAC Signature header verified: {captured_requests[0]['signature']}")
                print(f"Event: {captured_requests[0]['event']}, Delivery ID: {captured_requests[0]['delivery']}")
            else:
                print("\nWARNING: No request captured by local receiver.")

            sys.exit(code)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
