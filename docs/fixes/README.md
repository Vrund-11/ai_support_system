# SupportPilot Remediation Pack

Purpose: close every gap found in `reports/EVIDENCE-REPORT.md` so each resume claim is backed by something that was actually run.
Audience: you, or an AI agent (Claude Code, Cursor, Copilot) working in the repo. Environment: Windows + PowerShell, pnpm monorepo.

## Rules for any agent (copy into AGENTS.md)

1. Never fake or mock a result to make a check pass. If something cannot run, record why in `evidence/BLOCKERS.md`.
2. Never lower a threshold, delete a failing test, or edit an expected value just to turn it green, unless the test is provably wrong (explain in the commit).
3. Save raw command output into `evidence/<area>/` (text files and screenshots). Resume numbers come only from there.
4. Mock embeddings, mock LLMs and in-process benchmarks are allowed in unit tests only. They never produce a "quality" or "performance" number for the resume.
5. One fix per branch or commit group, conventional commits (`fix(security): ...`).
6. Finish each file's acceptance checklist before starting the next.

## Order and rough effort

| #   | File                                 | Fixes                                                                           | Effort |
| --- | ------------------------------------ | ------------------------------------------------------------------------------- | ------ |
| 01  | `01-security-and-secrets.md`         | leaked Redis secret, K8s secrets, 5 critical audit findings, probe disclosure   | 2-4 h  |
| 02  | `02-run-infrastructure.md`           | Docker, compose, kind/Kubernetes, GitHub push, green CI                         | 4-8 h  |
| 03  | `03-tests-and-quality.md`            | Playwright failures, Cypress, k6, coverage, honest test counts                  | 4-6 h  |
| 04  | `04-real-embeddings-and-rag-eval.md` | real embeddings, HNSW, honest RAG evaluation, ablation                          | 6-10 h |
| 05  | `05-ui-latency-implementation.md`    | optimistic UI, virtualisation, prefetch, streaming, index tuning                | 8-12 h |
| 06  | `06-mobile-build-and-push.md`        | EAS build evidence, Fastlane, real push                                         | 3-6 h  |
| 07  | `07-webhook-lambda-and-sqs.md`       | real Lambda handler, SQS, DLQ, Terraform on LocalStack                          | 3-5 h  |
| 08  | `08-docs-and-honesty-cleanup.md`     | doc mismatches, retros, changelog, AI-assisted statement, interview walkthrough | 2-4 h  |
| 09  | `09-evidence-and-reaudit.md`         | evidence folder, claim gating checklist, short re-audit prompt                  | 1-2 h  |

Total about 5 working days. Do 01 and 02 first: they change what you can honestly say on every resume.

## Definition of done for the whole pack

- No secrets in the repo or history; `pnpm audit --prod --audit-level=high` clean or each remaining item justified.
- `docker compose up`, a kind cluster and a green GitHub Actions run, all with saved proof.
- All Playwright and Cypress specs pass; k6 run with real output; coverage table for every package including Python.
- RAG evaluated with real embeddings on a human-written golden set, with an ablation table.
- Optimistic updates, virtualisation, prefetch and streaming implemented and measured before/after.
- One EAS preview build installed on an Android device; push either real FCM or honestly named Expo push.
- Lambda handler really signs and delivers webhooks with retries and a DLQ.
- Docs match code; sprints relabelled honestly; interview walkthrough written.
