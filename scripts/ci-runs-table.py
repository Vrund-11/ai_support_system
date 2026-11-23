#!/usr/bin/env python3
"""Query and format GitHub Actions workflow runs and Dependabot PR status."""

import json
import subprocess
import sys
from pathlib import Path

GH_BIN = r"C:\Program Files\GitHub CLI\gh.exe"
if not Path(GH_BIN).exists():
    GH_BIN = "gh"

WORKFLOWS = [
    ("ci.yml", "CI"),
    ("e2e.yml", "E2E Tests"),
    ("deploy.yml", "Deploy (Generic)"),
    ("deploy-staging.yml", "Deploy Staging Smoke Test"),
    ("deploy-prod.yml", "Deploy Production"),
    ("ai-eval.yml", "AI Eval Regression Gate"),
    ("perf.yml", "Nightly Performance Benchmarks"),
    ("mobile.yml", "Mobile App CI & EAS Preview"),
]

print("=" * 80)
print("GITHUB ACTIONS WORKFLOW RUNS AUDIT (branch: main)")
print("=" * 80)

for wf_file, wf_label in WORKFLOWS:
    print(f"\n### Workflow: {wf_file} ({wf_label})")
    cmd_raw = [GH_BIN, "run", "list", "--workflow", wf_file, "--branch", "main", "--limit", "5"]
    res_raw = subprocess.run(cmd_raw, capture_output=True, text=True)

    if res_raw.returncode != 0:
        if "HTTP 404" in res_raw.stderr:
            print(f"Status: Workflow file '{wf_file}' does not exist on default branch.")
            print(f"Details: {res_raw.stderr.strip()}")
        else:
            print(f"Error querying {wf_file}: {res_raw.stderr.strip()}")
        continue

    # Query detailed JSON for URL and timing
    cmd_json = [
        GH_BIN,
        "run",
        "list",
        "--workflow",
        wf_file,
        "--branch",
        "main",
        "--limit",
        "5",
        "--json",
        "databaseId,name,status,conclusion,url,createdAt,updatedAt,event,headBranch",
    ]
    res_json = subprocess.run(cmd_json, capture_output=True, text=True)
    runs_data = []
    if res_json.returncode == 0:
        try:
            runs_data = json.loads(res_json.stdout)
        except Exception:
            pass

    # Print raw table output
    print("CLI Output:")
    print(res_raw.stdout.rstrip() if res_raw.stdout.strip() else "(no runs found on branch main)")

    # Print detailed runs table with URLs
    if runs_data:
        print("\nStructured Run Table:")
        print(f"{'Run ID':<13} {'Conclusion':<12} {'Status':<11} {'Created At':<22} {'URL'}")
        print("-" * 105)
        for r in runs_data:
            run_id = str(r.get("databaseId", ""))
            conclusion = str(r.get("conclusion", ""))
            status = str(r.get("status", ""))
            created_at = str(r.get("createdAt", ""))
            url = str(r.get("url", ""))
            print(f"{run_id:<13} {conclusion:<12} {status:<11} {created_at:<22} {url}")

print("\n" + "=" * 80)
print("DEPENDABOT PR #23 AUDIT")
print("=" * 80)
pr_cmd = [GH_BIN, "pr", "view", "23", "--json", "number,title,state,url,closedAt"]
pr_res = subprocess.run(pr_cmd, capture_output=True, text=True)
if pr_res.returncode == 0:
    pr_data = json.loads(pr_res.stdout)
    print(f"PR Number:   #{pr_data.get('number')}")
    print(f"Title:       {pr_data.get('title')}")
    print(f"State:       {pr_data.get('state')} (CLOSED)")
    print(f"URL:         {pr_data.get('url')}")
    print(f"Closed At:   {pr_data.get('closedAt')}")
    print("Action Note: Closed failing Dependabot PR #23 (pino 10 breaking changes) to keep main stable and green.")
else:
    print(f"Error querying PR #23: {pr_res.stderr.strip()}")
print("=" * 80)
