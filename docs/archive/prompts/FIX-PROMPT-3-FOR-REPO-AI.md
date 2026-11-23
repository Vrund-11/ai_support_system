# FIX PROMPT 3 FOR THE REPO AI (paste everything below the line into the AI)

## HUMAN DOES THIS FIRST

1. `winget install Amazon.SAM-CLI`, restart the terminal.
2. Put a real Gemini key in `apps/ai-service/.env` (`GEMINI_API_KEY=...`). The old value is a placeholder.
3. Keep Docker Desktop running.

---

You are finishing a remediation. Same honesty rules as before: every evidence file comes from `scripts/capture-evidence.py` (command, UTC time, git SHA, exit code, raw output). Never retype results, never change expected values or thresholds to pass, never print secrets. Save under `evidence/reaudit4/`.

## 1. Kubernetes must actually run

Last evidence: pods were `ErrImagePull` / `ImagePullBackOff` 15 seconds after apply, and HPAs showed `cpu: <unknown>`.

- Make the image names in `infra/k8s/overlays/local` match the built images (`infra-gateway`, `infra-ticket-service`, `infra-notification-service`, `infra-ai-service`, `infra-web`), set `imagePullPolicy: IfNotPresent`, and run `kind load docker-image <image> --name supportpilot` for each.
- Install metrics-server (with `--kubelet-insecure-tls` for kind) and ingress-nginx.
- Run `kubectl rollout status` for every deployment, wait until Ready, then save `kubectl get pods,svc,hpa,ingress,networkpolicy -n supportpilot` and `kubectl top pods`.
- Prove a NetworkPolicy: from a temporary busybox pod, `wget` to ticket-service must FAIL; through the gateway it must work.
- If anything still fails, save the real error and mark COULD NOT RUN.

## 2. Fix the live API failures (Newman against the live gateway)

Latest live run: 73 assertions, 17 failed. Real examples: GET ticket detail returns 500; status transition, messages and public tracking return 404; cross-tenant read returns 500 instead of 404; link-tickets returns 400.

- Find root causes in the code (do not edit the collection or expectations unless an expectation is provably wrong; explain each).
- Fix the endpoints, re-run Newman until 0 failures, save the raw CLI output and the JSON export.
- Add regression tests (Vitest/Supertest) for each bug fixed.

## 3. Fix the 3 failing Cypress tests

`rbac-matrix.cy.ts`: (a) OWNER cockpit text 'Enterprise SupportPilot' not found, (b) unprivileged mutation returns 401, expected 403, (c) login field not found on role switch. Decide per case whether the app or the test is wrong, fix, re-run all 3 specs, save raw output. Report totals as passed/failed honestly.

## 4. Make scripts/count-tests.mjs correct

Current output is wrong: it printed Playwright live 0 (real: 7 passed), Cypress 7 (real: 14 tests across 3 specs), Playwright mocked 7 (check), and a Total that adds Newman assertions.

- Parse fresh outputs for every tool and print a per-tool table: tests, passed, failed, skipped.
- Do NOT add Newman assertions or multiply Playwright by browser into one "Total". Print "Unit and integration (Vitest + pytest)" as its own line.

## 5. Evaluation: fix the report text, then improve without cheating

- The independent ablation report still contains old template text ("115-question dataset", "hybrid outperforms", "reranker lifts Hit@1") that contradicts its table. Regenerate the narrative from the numbers. State: on the independent set (n=33 answerable) vector-only Hit@5 0.939 vs hybrid 0.818.
- The eval report said "Regression Gate: PASSED" only because of `--no-gate`. Show the targets missed (escalation recall 0.222, F1 0.353) as FAILED.
- Do NOT tune on `independent_v1.jsonl`. Tune the escalation threshold and hybrid fusion weights using the script-generated v2 set (or a split of it), freeze them, then re-run independent_v1 once and report the result, with the before and after.
- Run the LLM judge (30 samples) with the real Gemini key; if it still fails, record the exact error.

## 6. Containers and widget

- ai-service image is 9.6 GB. Use CPU-only PyTorch (`--extra-index-url https://download.pytorch.org/whl/cpu`) and a multi-stage build; report the new size. Remove stale images (`test-*`, `supportpilot-ai-service`).
- The widget container on :3001 serves the default "Welcome to nginx!" page. Verify what path serves the widget bundle, fix the nginx config so the widget is reachable, and save a curl proving it. Also `sp-web` was `unhealthy` in one run; fix the healthcheck and show it healthy.

## 7. CI on main

- `gh run list --workflow ci.yml --branch main --limit 5` and the same for e2e, deploy, ai-eval, perf, mobile. Save conclusion, URL, duration.
- Fix the failing E2E workflow (pino 10 Dependabot PR) or close that PR. Show main green.

## 8. Cleanup of evidence

- Strip `setup_data` (contains JWTs) from every `k6-*.json`. Redact `x-service-token` values in saved curl commands. Replace the dev token `supportpilot-internal-service-token-32c!` with a random value from env for anything outside local dev.
- Run `gitleaks detect --redact` on the full history and save the output.
- `lambda-sam-invoke.txt` was a typed echo, not a command. After SAM is installed, run `sam build` and `sam local invoke` with `infra/sam/events/sqs.json` and save the real output. Keep Terraform as PLAN ONLY (13 resources) unless applied.

## FINAL OUTPUT

Write `reports/REAUDIT-REPORT-4.md`: per task, the evidence file path and verbatim contents (trim only with a visible "[trimmed N lines]"), then a table Claim | Evidence file | VERIFIED / NOT VERIFIED / COULD NOT RUN / HUMAN TO CONFIRM. End with: "Every value above came from a command I ran in this session and was not retyped."
