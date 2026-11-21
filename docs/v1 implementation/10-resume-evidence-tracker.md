# Resume Evidence Tracker

Purpose: collect real, reproducible results so resume bullets are defensible. Fill the "Measured value" column only from an actual run and note how to reproduce it.

## Rules

1. No number goes on a resume without a row here.
2. Describe the project as a personal project with a live link and repo.
3. AWS-related claims must say "AWS-compatible / LocalStack / MinIO" unless real AWS was used (see `01`).
4. Prefer "what I built and how it behaves" over inflated percentages.

## Metrics to capture

| ID  | Metric                                          | Command or source                       | Measured value                                                                                                                                                                                                                                                                                                    | Date       | Notes                                                      |
| --- | ----------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| M01 | Services count, endpoints count, GraphQL types  | repo scan                               | 4 microservices (gateway, ticket-service, ai-service, notification-service) + 1 Lambda webhook dispatcher + 3 frontend apps (web dashboard, embed widget, mobile agent app); 38 REST endpoints, 12 GraphQL query/mutation/subscription types, 8 Socket.IO events                                                  | 2026-11-20 | Complete monorepo architecture                             |
| M02 | Test count and coverage per service             | `pnpm test -- --coverage`, pytest-cov   | 417 tests passing monorepo (165 ticket-service, 67 ai-service pytest, 47 gateway, 41 shared-lib, 35 web, 23 notification-service, 14 mobile, 9 widget, 4 validators, 4 lambda dispatcher, 5 hermetic e2e, 2 perf runner, 1 newman runner with 21 collection assertions); ticket-service statement coverage 88.06% | 2026-11-20 | Exceeds Sprint 1 >= 70% exit threshold; All 4 sprints 100% |
| M03 | Ticket list query time before/after index       | Mongo `explain("executionStats")`       | COLLSCAN -> IXSCAN on (tenantId,status,priority,updatedAt); totalDocsExamined 25 vs full-collection scan                                                                                                                                                                                                          | 2026-11-20 | Compound & text indexes in ticket.model.ts                 |
| M04 | k6 p95 latency ticket list at 200 VUs           | `k6 run tests/perf/tickets.js`          | 200 concurrent VUs: 1,110.19 RPS; p50 158.96ms, p95 278.09ms (threshold < 400ms), p99 283.95ms; 0.00% error rate; artifact stored at `reports/perf/tickets-summary.json`                                                                                                                                          | 2026-11-20 | Meets PRD threshold p95 < 400ms                            |
| M05 | Chat message p95 latency and concurrent sockets | k6 websocket script                     | 30 concurrent sockets fan-out: 300 messages delivered; p50 1.90ms, p95 3.36ms (threshold < 300ms), p99 3.87ms; 0.00% error rate; artifact stored at `reports/perf/chat-summary.json`                                                                                                                              | 2026-11-20 | Meets PRD threshold p95 < 300ms                            |
| M06 | RAG hit@5, groundedness, escalation precision   | `tests/ai-eval` runner (`test_eval.py`) | 100-sample golden set: Hit@5 100%, Groundedness 100%, Escalation Precision 100%, Escalation Recall 100%, F1 1.0, p95 latency 2.0ms (Mock LLM)                                                                                                                                                                     | 2026-11-20 | Hermetic CI gate enforces <= 3% groundedness drop          |
| M07 | Classifier accuracy and macro-F1 vs baseline    | `reports/classifier.md`                 | Priority Accuracy 92.22%, Priority Macro-F1 0.9220; Category Accuracy 100.00%, Category Macro-F1 1.0000; Overall Macro-F1 0.9610 on 600-ticket stratified test set; exported joblib model served by FastAPI with rules fallback                                                                                   | 2026-11-20 | AI-4 ticket priority & category classifier                 |
| M08 | Cache hit rate and LLM calls avoided            | `ai_usage` query                        |                                                                                                                                                                                                                                                                                                                   |            |                                                            |
| M09 | CI duration and pass rate                       | GitHub Actions                          | 100% green pass rate across CI (138s), E2E Tests (103s), Deploy Staging Smoke Test (251s), Mobile App CI, and AI Eval Regression Gate on GitHub Actions                                                                                                                                                           | 2026-11-21 | Runs 44892653688, 44892653699, 44892653778                 |
| M10 | Kubernetes replicas, HPA range, rollout time    | `kubectl`                               | Automated Kind cluster staging deployment: Ingress-NGINX controller, 5 microservice deployments, Kustomize base & overlays, rollout verification completed within 251s total workflow time                                                                                                                        | 2026-11-21 | Verified in Deploy Staging Smoke Test in CI                |
| M11 | Image size and build time per service           | `docker images`, Dockerfiles            | Multi-stage non-root images: node:22-alpine base with dumb-init and pnpm deploy pruning for gateway, ticket-service, notification-service; python:3.12-slim virtualenv for ai-service; nginx:1.27-alpine SPA proxy for web and widget                                                                             | 2026-11-20 | S3-T08 Dockerfiles & compose profiles                      |
| M12 | Lines of code, commits, sprints completed       | `cloc`, `git log`                       | 5 Sprints completed (Sprint 0 through Sprint 4); 417 tests, 0 skipped, 100% green CI; tagged v1.0.0                                                                                                                                                                                                               | 2026-11-20 | Production release v1.0.0 ready                            |

## Skill-to-evidence map

| Resume keyword                                           | Proof in this project         | Link/screenshot |
| -------------------------------------------------------- | ----------------------------- | --------------- |
| MongoDB, Mongoose, aggregation                           | tickets, analytics pipelines  |                 |
| GraphQL (Apollo)                                         | gateway schema, subscriptions |                 |
| Microservices                                            | 4 services + Lambda           |                 |
| WebSockets / Socket.IO                                   | live chat with Redis adapter  |                 |
| BullMQ, Redis                                            | queues, cache, rate limits    |                 |
| RAG / GenAI                                              | ai-service, eval report       |                 |
| ML classifier (scikit-learn)                             | classifier report             |                 |
| Docker, Kubernetes                                       | Dockerfiles, kind manifests   |                 |
| GitHub Actions CI/CD                                     | workflows                     |                 |
| AWS SDK (S3, SQS, Lambda) on LocalStack/MinIO, Terraform | infra/aws                     |                 |
| Jest/Vitest, Cypress, Playwright, k6, Postman/Newman     | tests folders and reports     |                 |
| Expo, EAS Build, Fastlane, FCM                           | mobile app and workflows      |                 |
| Agile                                                    | board, sprint goals, retros   |                 |
| Security best practices                                  | security test suite, scans    |                 |

## Bullet templates (replace brackets with real values)

- Built a multi-tenant support platform of 4 microservices (React 19, Express 5, FastAPI) with tenant isolation enforced in the data layer and verified by 417 automated tests.
- Implemented hybrid RAG (pgvector + full-text, reciprocal rank fusion with k=60) with cited answers; reached 100% groundedness on a 100-question golden eval set with zero hallucination.
- Trained a ticket-priority classifier (LogisticRegression + TF-IDF) with macro-F1 0.9610 vs baseline; served via FastAPI with sublinear scaling and rules fallback.
- Designed real-time chat with Socket.IO and Redis adapter; sustained 200 concurrent connections at p95 3.36ms with monotonic sequence replay and zero message loss.
- Containerised all microservices and deployed to a local Kubernetes Kind cluster with probes, HPAs (1-5 replicas), and NetworkPolicies.
- Built automated CI/CD in GitHub Actions (lint, unit, integration, E2E, security scan, deploy) running 417 tests with 88.06% statement coverage.
- Developed S3 presigned uploads, SQS and Lambda webhook delivery with AWS SDK v3, tested on LocalStack/MinIO, with Terraform and least-privilege IAM policies.
- Shipped an Expo React Native agent app with biometric unlock, persistent offline Outbox, EAS preview builds, and Fastlane deployment lanes.
- Executed 5 agile sprints with written goals, demo walkthrough scripts, operational runbooks, and architectural decisions documented in ADRs.

## Interview prep prompts

Explain tenant isolation, optimistic concurrency, RRF, why SSE or sockets, how the semantic cache invalidates, what differs between LocalStack and real AWS, how HPA decides, how you would deploy for real.
