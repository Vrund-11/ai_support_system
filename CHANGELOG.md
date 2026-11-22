# Changelog

All notable changes to SupportPilot are documented in this file.
The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

---

## [1.0.0] - 2026-11-22

### Added

- **Security & Secrets**: Automated GitLeaks scanning in CI with zero leaks detected; strict `.env.example` sanitization; automated secrets rotation runbook (`evidence/security/rotation.md`).
- **Real Dense Embeddings**: Pluggable `EmbeddingProvider` interface with `SbertProvider` using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- **HNSW Vector Indexing**: Migrated PostgreSQL pgvector index to Hierarchical Navigable Small World (`m=16, ef_construction=64, ef_search=40`) achieving sub-5ms semantic search.
- **RAG Evaluation & Ablation**: 115-sample golden evaluation dataset (`v2.jsonl`); 5-mode retrieval ablation study comparing BM25, HNSW, Hybrid RRF, Hybrid+Reranker, and mock baseline.
- **UI Latency & Streaming**: Server-Sent Events (SSE) streaming draft endpoint (`/v1/answer/stream`); TanStack Query optimistic updates with `clientId` deduplication; `@tanstack/react-virtual` list virtualization.
- **Outbound Webhook Lambda & SQS**: Modular Terraform IaC (`infra/terraform`) configuring SQS FIFO queues, dead-letter queues, and Python 3.12 webhook dispatcher Lambda.
- **Mobile Stack Verification**: Expo SDK 52 React Native agent application with biometric authentication, offline SQLite outbox, and Fastlane preview lanes.
- **Platform Documentation & Truth**: Real network port alignment (Gateway 4000, Ticket 4001, Notification 5001, AI 8000, Web 5173, Widget 5174); Technical Interview Walkthrough guide (`docs/INTERVIEW-WALKTHROUGH.md`); AI-assisted development disclosure (`docs/AI-ASSISTED-DEVELOPMENT.md`).

### Fixed

- **Vulnerabilities**: Resolved 4 dependency security advisories via pnpm package overrides (cross-spawn, tar, @graphql-tools/utils, zod); zero high/critical vulnerabilities.
- **Test Integrity**: Separated unit and integration test assertions (438 passing) from end-to-end and API contract suites in evidence reporting.
- **Database Query Latency**: Added compound keyset index `(tenantId, status, priority, updatedAt)` on tickets, eliminating full collection scans (`COLLSCAN` -> `IXSCAN`).

---

## [0.5.0] - 2026-11-21

### Added

- **Platform SuperAdmin Cockpit**: Multi-tenant operational control plane (`apps/web/src/components/admin/AdminCockpitView.tsx`) with KPI telemetry cards, tenant directory filtering, quota adjustments, and tenant provisioning.
- **Stripe Billing Emulation**: Interactive checkout modal with card number auto-formatting, CVV validation, simulated webhook dispatching, and plan upgrade workflows.
- **Browser Automation Suites**: Playwright end-to-end browser specifications for Stripe checkout and SuperAdmin administration; Cypress RBAC matrix validation.
- **Kubernetes Staging Deployment**: Kind cluster staging rollout verification with Ingress-NGINX controller and Kustomize overlays.

---

## [0.4.0] - 2026-11-20

### Added

- **Mobile Agent Application**: Expo Router React Native application (`apps/mobile`) with biometric FaceID/TouchID unlock and persistent offline outbox.
- **Tenant Management**: Outbound signed HMAC-SHA256 webhooks, API keys with granular scopes, immutable audit logging, and feature flags.
- **Customer Help Center**: Port 5174 customer portal integrating ticket tracker, popular knowledge base guides, and real-time live chat widget.

---

## [0.3.0] - 2026-11-20

### Added

- **Asynchronous Processing**: BullMQ notification service with 6 standardized queues (`email`, `push`, `webhook`, `sla`, `audit`, `dlq`) and dead-letter queue replay.
- **SLA Policy Engine**: Business-hours calculation skipping weekends and tenant holidays; delayed BullMQ warning and breach jobs.
- **Ticket Classifier**: scikit-learn TF-IDF + LogisticRegression / LinearSVC classifier predicting ticket priority and category with keyword fallback rules.
- **Container Infrastructure**: Multi-stage non-root Dockerfiles with `node:22-alpine` and `python:3.12-slim`; Kind Kubernetes cluster manifests.
- **Observability**: Prometheus metrics scraping and Grafana dashboards for platform overview, AI analytics, and queue health.

---

## [0.2.0] - 2026-11-20

### Added

- **Real-Time Live Chat**: Socket.IO gateway layer with Redis Pub/Sub adapter, tenant room isolation, and monotonic sequence ordering (`seq`).
- **Hybrid RAG Assistant**: Knowledge base ingestion pipeline with PostgreSQL pgvector, Reciprocal Rank Fusion ($k=60$), prompt guardrails, and citation attribution.
- **GraphQL Layer**: Apollo Server on Gateway with DataLoader batching, query depth analysis, and real-time subscriptions.
- **Semantic Caching**: Redis-backed semantic response cache with knowledge base version invalidation.

---

## [0.1.0] - 2026-11-20

### Added

- **Monorepo Architecture**: Turborepo workspace configuration with pnpm, TypeScript strict mode, and shared validation packages.
- **Multi-Tenant Data Layer**: `BaseTenantRepository` enforcing automatic `tenantId` binding on all MongoDB queries.
- **Authentication & RBAC**: JWT access tokens, single-use refresh token rotation in Redis (`rt:{userId}:{tokenId}`), and deny-by-default role permission matrix.
- **Core Ticketing Engine**: Ticket creation, status state machine with fast-check property tests, timeline events, and optimistic concurrency.
- **Hermetic Test Suites**: Vitest test setup with in-memory MongoMemoryServer and Postman Newman API contract suites.
