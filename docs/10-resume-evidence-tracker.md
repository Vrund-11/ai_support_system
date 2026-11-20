# Resume Evidence Tracker

Purpose: collect real, reproducible results so resume bullets are defensible. Fill the "Measured value" column only from an actual run and note how to reproduce it.

## Rules

1. No number goes on a resume without a row here.
2. Describe the project as a personal project with a live link and repo.
3. AWS-related claims must say "AWS-compatible / LocalStack / MinIO" unless real AWS was used (see `01`).
4. Prefer "what I built and how it behaves" over inflated percentages.

## Metrics to capture

| ID  | Metric                                          | Command or source                     | Measured value | Date | Notes |
| --- | ----------------------------------------------- | ------------------------------------- | -------------- | ---- | ----- |
| M01 | Services count, endpoints count, GraphQL types  | repo scan                             |                |      |       |
| M02 | Test count and coverage per service             | `pnpm test -- --coverage`, pytest-cov |                |      |       |
| M03 | Ticket list query time before/after index       | Mongo `explain("executionStats")`     |                |      |       |
| M04 | k6 p95 latency ticket list at 200 VUs           | `k6 run tests/perf/tickets.js`        |                |      |       |
| M05 | Chat message p95 latency and concurrent sockets | k6 websocket script                   |                |      |       |
| M06 | RAG hit@5, groundedness, escalation precision   | `tests/ai-eval` runner                |                |      |       |
| M07 | Classifier accuracy and macro-F1 vs baseline    | `reports/classifier.md`               |                |      |       |
| M08 | Cache hit rate and LLM calls avoided            | `ai_usage` query                      |                |      |       |
| M09 | CI duration and pass rate                       | GitHub Actions                        |                |      |       |
| M10 | Kubernetes replicas, HPA range, rollout time    | `kubectl`                             |                |      |       |
| M11 | Image size and build time per service           | `docker images`                       |                |      |       |
| M12 | Lines of code, commits, sprints completed       | `cloc`, `git log`                     |                |      |       |

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

- Built a multi-tenant support platform of [N] services (React, Node, FastAPI) with tenant isolation enforced in the data layer and verified by [N] automated cross-tenant tests.
- Implemented hybrid RAG (pgvector + full-text, reciprocal rank fusion) with cited answers; reached [X]% groundedness on a [N]-question eval set.
- Trained a ticket-priority classifier ([model]) with macro-F1 [X] versus [Y] baseline; served via FastAPI with rules fallback.
- Designed real-time chat with Socket.IO and the Redis adapter; sustained [N] concurrent connections at p95 [X] ms in k6 tests.
- Containerised all services and deployed to a local Kubernetes cluster with probes, HPA ([a]-[b] replicas) and NetworkPolicies.
- Built CI/CD in GitHub Actions (lint, unit, integration, E2E, security scan, deploy) running in [X] minutes with [Y]% coverage.
- Developed S3 presigned uploads, SQS and Lambda webhook delivery with AWS SDK v3, tested on LocalStack/MinIO, with Terraform and least-privilege IAM policies.
- Shipped an Expo React Native agent app with FCM push, secure token storage, EAS preview builds and a Fastlane lane.
- Ran [N] two-week sprints with written goals, demos and retrospectives; documented decisions in [N] ADRs.

## Interview prep prompts

Explain tenant isolation, optimistic concurrency, RRF, why SSE or sockets, how the semantic cache invalidates, what differs between LocalStack and real AWS, how HPA decides, how you would deploy for real.
