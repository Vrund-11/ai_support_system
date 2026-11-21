# 09 Evidence and Re-audit

## Evidence folder (commit text files; keep large videos out of git or use releases)

```
evidence/
  BLOCKERS.md
  security/   rotation.md  gitleaks.txt  audit-before.txt  audit-after.txt
  infra/      tool-versions.txt  compose-ps.txt  image-sizes.txt  kubectl-get.txt  hpa.txt  ci-runs.txt  screenshots/
  tests/      test-counts.md  coverage.md  playwright.txt  cypress.txt  newman.txt
  perf/       k6-load-summary.json  k6-spike-summary.json  k6-ws-summary.json  before.md  after.md  explain-before.txt  explain-after.txt  machine-specs.txt
  ai/         eval-<date>.md  ablation.md  classifier.md
  mobile/     eas-build-url.txt  fastlane.txt  push-recording.*  screenshots/
  aws/        tflocal-plan.txt  tflocal-apply.txt  sam-invoke.txt
  endpoints.md
```

## Claim gating table (fill the last column with the file path)

| Claim you want on resumes                  | Required evidence                | Status |
| ------------------------------------------ | -------------------------------- | ------ |
| Multi-tenant platform, [N] services        | `endpoints.md`, compose ps       |        |
| MongoDB indexing with measured improvement | explain before/after             |        |
| GraphQL with DataLoader                    | schema + test                    |        |
| Socket.IO with Redis adapter               | multi-instance test or k6 ws run |        |
| BullMQ queues with DLQ                     | worker tests                     |        |
| Hybrid RAG, evaluated                      | `ai/eval`, `ablation.md`         |        |
| Classifier macro-F1                        | `ai/classifier.md`               |        |
| [N] automated tests, [X]% coverage         | `test-counts.md`, `coverage.md`  |        |
| Playwright and Cypress E2E in CI           | CI run URLs                      |        |
| k6 load tests                              | k6 summaries + machine specs     |        |
| Docker and Kubernetes (kind)               | compose/kubectl output           |        |
| GitHub Actions CI/CD                       | green runs + durations           |        |
| Terraform/SQS/Lambda on LocalStack         | aws evidence                     |        |
| EAS Android build                          | build URL + install proof        |        |
| Push notifications                         | recording                        |        |
| Latency improvements                       | `perf/before.md`, `after.md`     |        |
| Security scanning                          | gitleaks + audit in CI           |        |

A claim with an empty Status does not go on a resume.

## Short re-audit prompt (give to the AI in the repo)

```text
You are verifying fixes. Do not praise; report evidence only. For every item below, run the command, paste the real output, and mark VERIFIED or NOT VERIFIED with the file path. Do not modify files.
1. Secrets: run `gitleaks detect --redact`; `git log -p -S"REDACTED" --all | head`; list files matching secret.yaml with real values.
2. Audit: `pnpm audit --prod --audit-level=high`; `pip-audit` in apps/ai-service.
3. Infra: `docker compose -f infra/docker-compose.yml ps`; `kubectl get pods,hpa,networkpolicy -n supportpilot`; `gh run list --limit 10`; for the latest run of each workflow, give status and duration.
4. Tests: run the test-count script; print evidence/tests/test-counts.md and coverage.md; run Playwright and Cypress and paste summaries.
5. Perf: print the k6 summaries (p95, error rate, VUs, rps) and machine specs; print before.md and after.md.
6. AI: print the embedding provider in use at runtime, the model name stored in chunk metadata, the latest eval report and ablation table, and the golden-set size and authorship note.
7. UI: grep for optimistic update helper usage, @tanstack/react-virtual usage, prefetchQuery usage, and the streaming hook; list files.
8. Mobile: print the EAS build URL and build status; list fastlane lanes executed; show the push sender implementation and which service it calls.
9. Lambda/SQS: show the handler, run `sam local invoke` with the sample event and paste output; show terraform plan/apply output.
10. Docs: list every README or doc statement that contradicts code (ports, queues, embeddings, CI jobs).
Finish with: "I did not invent or estimate any value in this report."
```

## After the re-audit

Send me the new report. I will rebuild the 10 resumes with this project as the lead entry, using only the verified numbers, and tell you which claims to keep or drop.
