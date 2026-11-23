# FIX PROMPT 4 FOR THE REPO AI (paste everything below the line into the AI)

Final small round. Same rules: every evidence file comes from `scripts/capture-evidence.py` (command, UTC time, git SHA, exit code, raw output); never retype results; never change expected values or thresholds to pass; never print secrets. Save under `evidence/reaudit5/`.

## 1. Make main green (most important)

Latest runs on `main` (from your own Report 4): `ci.yml` FAILED (run 45029074320), `e2e.yml` FAILED (45029074326), `deploy-staging.yml` FAILED (45029074338), `perf.yml` FAILED twice. Closing Dependabot PR #23 does not fix these.

- Commit and push the current local work (it is on commit f5cd9d7 and later, but the failing runs are on older commits).
- For each failing workflow, read the failing job log (`gh run view <id> --log-failed`), find the root cause, fix the code or workflow, push, and re-run until green. Save the failing log excerpt (verbatim, with a "[trimmed N lines]" marker) and the passing run URL and duration.
- `perf.yml`: it needs a live stack and k6. Either make it start the compose stack and run k6, or change its trigger to `workflow_dispatch` only and say so. Do not leave a nightly job that fails every night.
- `deploy.yml` does not exist; remove references to it. `deploy-prod.yml` has never run; mark it "not executed".
- Final proof: `gh run list --branch main --limit 20` and, per workflow, the latest conclusion. All of ci, e2e, deploy-staging, ai-eval, mobile must be `success`.

## 2. Fix the ablation write-up so text matches its table

`evidence/reaudit4/independent-ablation.md` has a table (Hybrid Hit@5 0.848 / MRR 0.763; Reranker Hit@1 0.606 / Hit@5 0.818; Mock Hit@5 0.242) but the narrative still quotes older numbers (Hybrid 0.818 / 0.740, Reranker 0.545, Mock 0.455).

- Make `scripts/ablation.py` generate the narrative numbers from the same result object as the table. No hand-typed numbers in the markdown template.
- Re-run and save. State plainly: vector-only has the best Hit@5 (0.939); hybrid has the best Hit@1 (0.727); the reranker lowers results; n=33.

## 3. LLM judge: show the scores or drop the claim

Report 4 says "27 successful judge evaluations, 3 quota 429s" but shows no scores.

- Print the judge results: per sample id, verdict, and the aggregate (mean groundedness over the successful samples, n). Save the raw JSON.
- If scores cannot be produced, remove the claim and write COULD NOT RUN with the error.
- Also run `/v1/answer` for 10 independent questions with the real Gemini provider and save the raw responses, so there is at least one real-LLM sample.

## 4. Show the tuning evidence

Report 4 claims escalation threshold and hybrid weights were tuned on the v2 set and then frozen. Save the tuning run output (the values tried, the v2 scores for each, and the chosen values) and the git commit where the frozen values were set.

## 5. Small consistency fixes

- Terraform: the claims table says "18 resources", the plan shows 13. Re-run `terraform plan -no-color` and save the real count. Keep it PLAN ONLY.
- SAM: the local invoke ran, but delivery failed because nothing was listening on `host.docker.internal:9999`, so the handler returned `batchItemFailures`. Start a tiny local receiver (e.g. a Python http.server on 9999 that returns 200), invoke again, and save the successful-delivery output including the HMAC signature header received. Keep the failure run as a separate "retry path" evidence file.
- Remove any `VERIFIED` that cites an unrelated file (for example "JWTs stripped from k6 summaries" cites the gitleaks file). Point each claim at the file that proves it, or mark it NOT VERIFIED.
- Show the real `pnpm verify` output (the "42/42 tasks" claim was a summary only).

## FINAL OUTPUT

`reports/REAUDIT-REPORT-5.md`: per task, the evidence file path and verbatim contents (trim only with a visible marker), then a table Claim | Evidence file | VERIFIED / NOT VERIFIED / COULD NOT RUN / HUMAN TO CONFIRM. End with: "Every value above came from a command I ran in this session and was not retyped."
