#!/usr/bin/env python3
"""Run SAM build and SAM local invoke against WebhookFunction."""

import os
import subprocess
import sys
from pathlib import Path

SAM_BIN = r"C:\Program Files\Amazon\AWSSAMCLI\bin\sam.cmd"
REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = REPO_ROOT / "infra" / "sam" / "template.yaml"
EVENT_PATH = REPO_ROOT / "infra" / "sam" / "events" / "sqs.json"
BUILD_DIR = REPO_ROOT / "infra" / "sam" / ".aws-sam" / "build"
BUILT_TEMPLATE = BUILD_DIR / "template.yaml"

env = os.environ.copy()
env["SAM_CLI_TELEMETRY"] = "0"

print("=" * 80)
print("1. RUNNING SAM BUILD")
print(f"Command: sam build --template {TEMPLATE_PATH}")
print("=" * 80)

build_proc = subprocess.run(
    [SAM_BIN, "build", "--template", str(TEMPLATE_PATH)],
    cwd=str(REPO_ROOT / "infra" / "sam"),
    env=env,
    capture_output=True,
    text=True,
)
print("--- BUILD STDOUT ---")
print(build_proc.stdout)
print("--- BUILD STDERR ---")
print(build_proc.stderr)
print(f"Build Exit Code: {build_proc.returncode}")

if build_proc.returncode != 0:
    print("Build failed, aborting invoke.")
    sys.exit(build_proc.returncode)

print("\n" + "=" * 80)
print("2. RUNNING SAM LOCAL INVOKE")
print(f"Command: sam local invoke WebhookFunction -e {EVENT_PATH} -t {BUILT_TEMPLATE}")
print("=" * 80)

invoke_proc = subprocess.run(
    [
        SAM_BIN,
        "local",
        "invoke",
        "WebhookFunction",
        "-e",
        str(EVENT_PATH),
        "-t",
        str(BUILT_TEMPLATE),
    ],
    cwd=str(REPO_ROOT / "infra" / "sam"),
    env=env,
    capture_output=True,
    text=True,
)
print("--- INVOKE STDOUT ---")
print(invoke_proc.stdout)
print("--- INVOKE STDERR ---")
print(invoke_proc.stderr)
print(f"Invoke Exit Code: {invoke_proc.returncode}")

sys.exit(invoke_proc.returncode)
