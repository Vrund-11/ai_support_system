# FIX PROMPT 2 FOR THE REPO AI (paste everything below the line into the AI)

## HUMAN DOES THIS FIRST (the AI cannot)

1. Create a NEW valid Gemini API key and put it in `.env` as `GEMINI_API_KEY=...` (the old one returns HTTP 401). Do not paste it anywhere else.
2. Install SAM CLI: `winget install Amazon.SAM-CLI`; restart the terminal.
3. Start Docker Desktop and leave it running.
4. Write 40 or more support questions yourself in `tests/ai-eval/golden/human_v1.jsonl` (the AI must not write them). Use the schema in `tests/ai-eval/golden/README.md`.

---

You are continuing a remediation after a second audit. Honesty rules override everything else.

## RULES

1. Every evidence file is produced by `scripts/capture-evidence.py` (command, UTC timestamp, git SHA, exit code, raw stdout/stderr). Do not retype, reformat, summarise or "clean up" tool output. In reports, paste the evidence file contents verbatim or point to the file.
2. Never claim VERIFIED without a saved file proving it. A tool being installed is NOT the same as a test having run.
3. Never write test data that is labelled as human-written unless a human wrote it. Never edit expected values or thresholds to pass.
4. Never print or commit secrets. Re-run `gitleaks detect --redact` on full history and `grep -rniE "redis://|rediss://|AIza|password=" reports evidence docs` and save both outputs.
5. Save everything under `evidence/reaudit3/`.

## TASKS (in order)

### A. Dataset honesty

- `tests/ai-eval/golden/human_v1.jsonl` was written by the AI. Rename it to `ai_written_v1.jsonl`, fix every reference and doc, and state "AI-written" next to every metric from it.
- Leave `human_v1.jsonl` for the human. Only evaluate it if it contains at least 40 rows that the human wrote; report it separately.
- Explain with evidence why citations show `doc_id: doc-kb-001, title: SupportPilot Knowledge Base` for all 134 chunks. Show the SQL `SELECT d.title, count(*) FROM kb_chunks c JOIN kb_documents d ON d.id=c.document_id GROUP BY 1`. State exactly how Hit@k decides a hit (by document slug? by chunk id?) with the code lines. If all chunks sit under one document, fix ingestion so the 55 documents stay distinct, re-embed, re-run eval and ablation.

### B. Generation and groundedness honesty

- Show which LLM provider generated answers in the eval (print provider name per run). If it is the mock/template provider, rename the metric everywhere to "Lexical overlap (mock generator)" and remove "groundedness" wording.
- With the new Gemini key, run `/v1/answer` for 20 real questions with the real provider and save raw responses. Run the LLM-judge on a 30-row sample and save the result. If the key still fails, record COULD NOT RUN.

### C. Real containers, live E2E, live API tests

- Build and start the application containers: `docker compose -f infra/docker-compose.infra.yml up -d` and `docker compose -f infra/docker-compose.yml up -d --build`. Save `docker compose ps`, `docker images`, and a health curl for gateway, ticket-service, ai-service, notification-service.
- Run the Playwright `live` project against that stack and save the raw summary (specs, passed, failed). Do not count mocked tests as live.
- Run Newman against the compose gateway with raw output: `newman run <collection> --reporters cli,json --reporter-json-export evidence/reaudit3/newman-live.json`. Save the unmodified CLI output. Keep the in-process mock version labelled "contract test (mock server)".
- Run `cypress run` (not just verify) and save the raw result.
- Run k6: load, spike and websocket scripts with `--summary-export evidence/reaudit3/k6-<name>.json` against the compose stack. Record CPU, RAM, Docker memory. DELETE the old synthetic files `evidence/perf/k6-*.json` and any text that cites them.

### D. Kubernetes

- `kind create cluster --name supportpilot --config infra/k8s/kind-config.yaml`; install ingress-nginx and metrics-server; `kind load docker-image` for each image; `kubectl apply -k infra/k8s/overlays/local`.
- Save `kubectl get pods,svc,hpa,ingress,networkpolicy -n supportpilot`, `kubectl rollout status` for each deployment, `kubectl top pods`, and a NetworkPolicy test from a temporary pod. If it fails, save the error and COULD NOT RUN.

### E. Tests: one honest total

- Run every suite fresh: Vitest per package (with coverage), pytest with coverage, Playwright mocked, Playwright live, Cypress, Newman. Fix `scripts/count-tests.mjs` so it reads these fresh outputs for ALL packages (the last run showed 438 total while earlier fresh runs showed 502 Vitest plus 86 pytest; reconcile it). Print a per-tool table: tests, passed, failed, skipped, duration. Do not add Newman assertions or Playwright browser-multiplied counts to the unit total.
- Report coverage per package; list packages with no coverage as "not measured".

### F. CI

- `gh run list --workflow ci.yml --branch main --limit 5`, then the same for e2e, deploy, ai-eval, perf, mobile workflows. Save conclusions, URLs and durations with `gh run view <id> --json startedAt,updatedAt,conclusion`.
- The `E2E Tests` workflow failed on the pino 10 Dependabot PR. Find the cause; fix or close the PR; show main is green.

### G. Lambda

- With SAM installed: `sam build` then `sam local invoke WebhookFunction --event infra/sam/events/sqs.json`. Save raw output. Terraform: keep PLAN ONLY unless applied; show the plan count.

### H. Final report

Write `reports/REAUDIT-REPORT-3.md` as: for each task, the evidence file path plus the verbatim contents (trimmed only with a visible "[trimmed N lines]" marker). End with a table Claim | Evidence file | VERIFIED / NOT VERIFIED / COULD NOT RUN / HUMAN TO CONFIRM, and the line "Every value above came from a command I ran in this session and was not retyped."
