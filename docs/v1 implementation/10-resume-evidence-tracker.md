# Resume Evidence Tracker & Claim Gating Table

Purpose: Collect real, reproducible results so resume bullets are defensible. Fill the "Status / Evidence File" column only from an actual run.

---

## 1. 16-Claim Gating Table

A claim with an empty Status does not go on a resume. Every claim below is mapped to an authoritative empirical evidence file in `evidence/`.

| #   | Claim you want on resumes                                                            | Required Evidence                | Status (Empirical Evidence File Path)                                                                                |
| --- | ------------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Multi-tenant platform, 4 microservices + 1 Lambda + 3 frontends (126 endpoints)      | `endpoints.md`, compose ps       | `evidence/endpoints.md`<br/>`evidence/infra/compose-ps.txt`                                                          |
| 2   | MongoDB compound keyset indexing with measured improvement (416ms -> 3ms)            | explain before/after             | `evidence/perf/explain-before.txt`<br/>`evidence/perf/explain-after.txt`                                             |
| 3   | GraphQL API with DataLoader batching & complexity limits                             | schema + tests                   | `apps/gateway/src/graphql/schema.ts`<br/>`apps/gateway/tests/graphql.test.ts`                                        |
| 4   | Socket.IO real-time chat with Redis Pub/Sub adapter & sequence replay                | multi-instance test or k6 ws run | `evidence/perf/k6-ws-summary.json`<br/>`apps/gateway/tests/socket-auth-rooms.test.ts`                                |
| 5   | BullMQ asynchronous queues (6 standardized) with DLQ & backoff retries               | worker tests                     | `apps/notification-service/tests/queue-manager.test.ts`<br/>`evidence/infra/compose-ps.txt`                          |
| 6   | Hybrid RAG (SBERT + pgvector HNSW + BM25 RRF), evaluated on golden set               | `ai/eval`, `ablation.md`         | `evidence/ai/eval-2026-11-22.md`<br/>`evidence/ai/ablation.md`                                                       |
| 7   | Ticket priority & category classifier macro-F1 (0.9610 overall, 1.0000 category)     | `ai/classifier.md`               | `evidence/ai/classifier.md`                                                                                          |
| 8   | 438 automated tests, 80.04% monorepo line coverage                                   | `test-counts.md`, `coverage.md`  | `evidence/tests/test-counts.md`<br/>`evidence/tests/coverage.md`                                                     |
| 9   | Playwright & Cypress end-to-end browser automation suites in CI                      | CI run URLs / specs              | `evidence/infra/ci-runs.txt`<br/>`evidence/tests/playwright.txt`<br/>`evidence/tests/cypress.txt`                    |
| 10  | k6 performance load & spike testing (1,110.19 RPS; p95 278.09ms)                     | k6 summaries + machine specs     | `evidence/perf/k6-load-summary.json`<br/>`evidence/perf/k6-spike-summary.json`<br/>`evidence/perf/machine-specs.txt` |
| 11  | Docker multi-stage images & Kubernetes Kind cluster staging deployment               | compose/kubectl output           | `evidence/infra/compose-ps.txt`<br/>`evidence/infra/kubectl-get.txt`<br/>`evidence/infra/hpa.txt`                    |
| 12  | GitHub Actions CI/CD (100% green pass rate across 5 workflows)                       | green runs + durations           | `evidence/infra/ci-runs.txt`                                                                                         |
| 13  | Terraform SQS & Lambda webhook dispatcher (LocalStack / SAM Local)                   | aws evidence                     | `evidence/aws/tflocal-plan.txt`<br/>`evidence/aws/tflocal-apply.txt`<br/>`evidence/aws/sam-invoke.txt`               |
| 14  | EAS Android standalone APK build & local Gradle prebuild                             | build info + install proof       | `evidence/mobile/eas-build-url.txt`<br/>`evidence/mobile/build-info.md`                                              |
| 15  | Push notifications with deep linking and receipt tracking                            | push trace / recording           | `evidence/mobile/push-recording.txt`<br/>`evidence/mobile/push-verification.md`                                      |
| 16  | Latency improvements via keyset cursor pagination & query optimization               | `perf/before.md`, `after.md`     | `evidence/perf/before.md`<br/>`evidence/perf/after.md`                                                               |
| 17  | Security scanning: zero secret leaks (Gitleaks) & zero high/critical vulnerabilities | gitleaks + audit reports         | `evidence/security/gitleaks.txt`<br/>`evidence/security/audit-after.txt`<br/>`evidence/security/rotation.md`         |

---

## 2. Verified Metrics Summary

| ID      | Metric                            | Source Command                                                       | Empirical Value                                                                                    | Verification Date |
| ------- | --------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| **M01** | Services & Endpoints Count        | `scripts/list-endpoints.mjs`                                         | 4 microservices + 1 Lambda + 3 frontends; 126 endpoints (103 business, 23 probe)                   | 2026-11-22        |
| **M02** | Test Counts & Monorepo Coverage   | `node scripts/count-tests.mjs`<br/>`node scripts/coverage-table.mjs` | **438 passing unit/integration tests** (361 Vitest, 77 Pytest, 0 failed); **80.04%** line coverage | 2026-11-22        |
| **M03** | Ticket Query Optimization         | MongoDB `explain("executionStats")`                                  | `COLLSCAN` (416ms, 10,000 docs) -> `IXSCAN` (3ms, 20 docs examined)                                | 2026-11-22        |
| **M04** | API Throughput & Latency (k6)     | `tests/perf/tickets.js`                                              | 1,110.19 RPS; p50 158.96ms, p95 278.09ms, p99 283.95ms under 200 VUs                               | 2026-11-22        |
| **M05** | WebSocket Latency (k6)            | `tests/perf/chat.js`                                                 | p50 1.90ms, p95 3.36ms, p99 3.87ms across 30 concurrent sockets                                    | 2026-11-22        |
| **M06** | Hybrid RAG Retrieval Quality      | `tests/ai-eval/run.py`                                               | Hit@1: 88.2%, Hit@5: 97.6%, MRR: 0.925, Groundedness: 97.4%, Escalation F1: 0.937                  | 2026-11-22        |
| **M07** | Classifier Macro-F1               | `apps/ai-service/src/classifier/`                                    | Priority Accuracy: 92.22%, F1: 0.9220; Category Accuracy: 100%, F1: 1.0000; Overall: 0.9610        | 2026-11-22        |
| **M09** | CI Pipeline Pass Rate & Durations | GitHub Actions                                                       | 100% green pass rate: CI (138s), E2E (103s), Deploy Staging Smoke (251s)                           | 2026-11-21        |
| **M10** | Kubernetes Kind Staging Rollout   | `kubectl rollout status`                                             | Ingress-NGINX controller, 5 deployments, HPA 2-5 replicas, 100% healthy                            | 2026-11-21        |
| **M11** | Container Image Footprint         | Docker multi-stage                                                   | Gateway (184MB), Ticket (210MB), Notification (178MB), AI (385MB), Web (38MB), Widget (24MB)       | 2026-11-22        |
| **M12** | Secret Scanning & Security        | `gitleaks detect --redact`<br/>`pnpm audit --prod`                   | Zero leaks across 71 commits; zero high/critical vulnerabilities                                   | 2026-11-22        |

---

## 3. Defensible Resume Bullet Templates

- Designed a multi-tenant customer support platform of 4 microservices (Express 5, FastAPI) with data isolation enforced at repository level (`BaseTenantRepository`), validated across 438 automated tests.
- Engineered hybrid RAG pipeline fusing SBERT dense embeddings (`all-MiniLM-L6-v2`) in PostgreSQL pgvector HNSW with BM25 full-text search via Reciprocal Rank Fusion ($k=60$); achieved 97.6% Hit@5 and 97.4% groundedness on 115-sample evaluation suite.
- Trained ticket classification model (TF-IDF + LogisticRegression) achieving 0.9610 macro-F1 on multi-category support inquiries, deployed with sub-5ms inference latency and deterministic keyword fallback.
- Implemented real-time chat architecture with Socket.IO and Redis Pub/Sub adapter; achieved p95 3.36ms message delivery across 30 concurrent sockets with monotonic sequence replay on reconnection.
- Optimized high-volume MongoDB ticket queries via compound keyset indexing `(tenantId, status, priority, updatedAt)`, reducing query latency from 416ms (`COLLSCAN`) to 3ms (`IXSCAN`).
- Containerized 5 microservices using multi-stage non-root Alpine Dockerfiles and deployed to local Kubernetes Kind cluster with Ingress-NGINX, HPAs, and zero-trust NetworkPolicies.
- Built end-to-end CI/CD in GitHub Actions with automated secret scanning (Gitleaks), unit/integration test suites (80.04% line coverage), Playwright/Cypress E2E tests, and Kind staging rollouts.
