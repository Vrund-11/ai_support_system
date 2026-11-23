#!/usr/bin/env python3
"""
scripts/scan_secrets.py
Scan git tracked files for exposed secrets, API keys, credentials, and tokens.
"""
import re
import subprocess
import sys

PATTERNS = [
    (r"AIza[0-9A-Za-z-_]{35}", "Google API Key"),
    (r"ghp_[0-9A-Za-z]{36}", "GitHub Personal Access Token"),
    (r"gho_[0-9A-Za-z]{36}", "GitHub OAuth Token"),
    (r"glpat-[0-9a-zA-Z\-_]{20}", "GitLab Personal Access Token"),
    (r"xox[baprs]-[0-9a-zA-Z]{10,48}", "Slack Token"),
    (r"-----BEGIN (?:RSA|OPENSSH|DSA|EC) PRIVATE KEY-----", "Private Key"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
]

def main():
    print("=== SupportPilot Repository Secret Audit ===")
    cmd = ["git", "ls-files"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    files = res.stdout.strip().splitlines()

    total_findings = 0
    ignored_extensions = {".png", ".jpg", ".jpeg", ".ico", ".pdf", ".zip", ".gz", ".lock", ".pyc"}

    for f in files:
        if any(f.endswith(ext) for ext in ignored_extensions):
            continue
        try:
            with open(f, "r", encoding="utf-8", errors="ignore") as fh:
                content = fh.read()
        except Exception:
            continue

        for pat, name in PATTERNS:
            matches = list(re.finditer(pat, content))
            for m in matches:
                total_findings += 1
                val = m.group(0)
                redacted = val[:4] + "..." + val[-4:]
                print(f"[ALERT] {name} found in {f}: {redacted}")

    print(f"\nAudit complete: {len(files)} tracked files scanned.")
    if total_findings == 0:
        print("Verdict: PASS - 0 leaked secrets or tokens detected in tracked files.")
        sys.exit(0)
    else:
        print(f"Verdict: FAIL - {total_findings} findings detected.")
        sys.exit(1)

if __name__ == "__main__":
    main()
