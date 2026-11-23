#!/usr/bin/env python3
"""
Automated evidence capture runner for SupportPilot reaudit.
Executes shell commands, captures stdout/stderr, records UTC timestamp,
git commit SHA, exit code, and redacts sensitive credentials before saving
to evidence/reaudit2/<name>.
"""

import argparse
import datetime
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO_ROOT / "evidence" / "reaudit4"

# Extra directories to prepend to PATH for Windows host tooling
EXTRA_PATHS = [
    str(REPO_ROOT / "apps" / "ai-service" / ".venv" / "Scripts"),
    r"C:\Program Files\GitHub CLI",
    r"C:\Program Files\k6",
    r"C:\Program Files\Amazon\AWSSAMCLI\bin",
]

SECRET_PATTERNS = [
    (re.compile(r"(redis://(?::|[^:]+:))[^@]+(@[^\s\'\"\`]+)", re.IGNORECASE), r"\1[REDACTED]\2"),
    (re.compile(r"(postgres(?:ql)?://(?::|[^:]+:))[^@]+(@[^\s\'\"\`]+)", re.IGNORECASE), r"\1[REDACTED]\2"),
    (re.compile(r"(mongodb(?:\+srv)?://(?::|[^:]+:))[^@]+(@[^\s\'\"\`]+)", re.IGNORECASE), r"\1[REDACTED]\2"),
    (re.compile(r"AQ\.[A-Za-z0-9_-]{20,}", re.IGNORECASE), "[REDACTED_GEMINI_KEY]"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9\._-]{20,}", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    (re.compile(r"(SUPERADMIN_PASSWORD=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(JWT_[A-Z_]*SECRET=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(SERVICE_TOKEN=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(WEBHOOK_SIGNING_SECRET=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(ENCRYPTION_KEY=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(AWS_SECRET_ACCESS_KEY=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(OPENAI_API_KEY=)[^\s]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"sk-[A-Za-z0-9_-]{20,}", re.IGNORECASE), "[REDACTED_API_KEY]"),
    (re.compile(r"(x-service-token:\s*)[^\s\'\"\`]+", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    (re.compile(r"supportpilot-internal-service-token-[^\s\'\"\`]+", re.IGNORECASE), "[REDACTED_TOKEN]"),
]


def redact_secrets(text: str) -> str:
    """Redacts known secrets and credentials from raw output text."""
    if not text:
        return ""
    result = text
    for pattern, replacement in SECRET_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def get_git_sha(cwd: Path) -> str:
    """Retrieves current git commit SHA."""
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True,
        )
        return proc.stdout.strip()
    except Exception:
        return "UNKNOWN_GIT_SHA"


def get_augmented_env() -> dict:
    """Returns os.environ with extra tool paths prepended to PATH."""
    env = os.environ.copy()
    current_path = env.get("PATH", "")
    valid_extras = [p for p in EXTRA_PATHS if os.path.exists(p)]
    if valid_extras:
        env["PATH"] = os.pathsep.join(valid_extras) + os.pathsep + current_path

    # Cypress requires ELECTRON_RUN_AS_NODE to not be set to '1'
    if "ELECTRON_RUN_AS_NODE" in env:
        env.pop("ELECTRON_RUN_AS_NODE", None)

    return env


def capture_command(
    name: str,
    command: str,
    cwd: Path = REPO_ROOT,
    out_dir: Path = DEFAULT_OUT_DIR,
    shell: bool = True,
) -> int:
    """
    Executes a command, records metadata and output, and writes to evidence file.
    Returns the exit code of the command.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / (name if name.endswith(".txt") or name.endswith(".json") or name.endswith(".log") else f"{name}.txt")

    utc_now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    git_sha = get_git_sha(cwd)
    env = get_augmented_env()

    stdout_text = ""
    stderr_text = ""
    exit_code = 0

    try:
        proc = subprocess.run(
            command,
            cwd=str(cwd),
            shell=shell,
            capture_output=True,
            text=True,
            env=env,
            timeout=300,
        )
        stdout_text = proc.stdout
        stderr_text = proc.stderr
        exit_code = proc.returncode
    except FileNotFoundError as fnf:
        exit_code = 127
        stderr_text = f"COULD NOT RUN: Executable not found: {fnf}\n"
    except subprocess.TimeoutExpired as te:
        exit_code = 124
        stdout_text = te.stdout or ""
        stderr_text = f"COULD NOT RUN: Command timed out after 300s: {te}\n"
    except Exception as exc:
        exit_code = 1
        stderr_text = f"COULD NOT RUN: Execution error: {exc}\n"

    redacted_stdout = redact_secrets(stdout_text)
    redacted_stderr = redact_secrets(stderr_text)
    redacted_command = redact_secrets(command)

    artifact_content = [
        "=== EVIDENCE ARTIFACT ===",
        f"Target: {name}",
        f"Command: {redacted_command}",
        f"Timestamp (UTC): {utc_now}",
        f"Git Commit: {git_sha}",
        f"Exit Code: {exit_code}",
        "========================",
        "--- STDOUT ---",
        redacted_stdout.rstrip(),
        "--- STDERR ---",
        redacted_stderr.rstrip(),
        "",
    ]

    out_path.write_text("\n".join(artifact_content), encoding="utf-8")
    print(f"Captured: {out_path} (Exit: {exit_code})")
    return exit_code


def main():
    parser = argparse.ArgumentParser(description="Capture live command execution as audited evidence.")
    parser.add_argument("--name", required=True, help="Artifact name (e.g. 01-git-status or compose-ps.txt)")
    parser.add_argument("--command", required=True, help="Command line string to execute")
    parser.add_argument("--cwd", default=str(REPO_ROOT), help="Working directory (default: repo root)")
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="Output directory (default: evidence/reaudit2)")

    args = parser.parse_args()
    code = capture_command(
        name=args.name,
        command=args.command,
        cwd=Path(args.cwd),
        out_dir=Path(args.out_dir),
    )
    sys.exit(code)


if __name__ == "__main__":
    main()
