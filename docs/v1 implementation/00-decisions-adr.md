# Architecture Decision Records

Format: Context, Decision, Consequences. Add new ADRs at the bottom; never rewrite history.

## ADR-001 Monorepo with pnpm + Turborepo

Context: many apps share types and validators. Decision: one monorepo. Consequence: one CI, shared packages, atomic changes.

## ADR-002 MongoDB for tickets and messages, Postgres for vectors, audit and usage

Context: tickets are document-shaped with flexible custom fields; vectors need pgvector. Decision: use both, each owned by one service. Consequence: two datastores to operate, but each is used for what it does best and both skills are exercised.

## ADR-003 Gateway exposes GraphQL for the dashboard and REST for widget and webhooks

Context: dashboard needs flexible queries; widget and third parties need simple stable endpoints. Decision: both on one gateway. Consequence: schema and REST contracts both need tests.

## ADR-004 Socket.IO with Redis adapter

Context: horizontal scale of chat. Decision: Socket.IO plus `@socket.io/redis-adapter`. Consequence: sequence numbers per conversation for replay.

## ADR-005 BullMQ for async work

Context: ingestion, SLA timers, notifications, webhooks. Decision: BullMQ on Redis. Consequence: need DLQ, idempotent consumers.

## ADR-006 RAG with hybrid retrieval and citations, escalation on low confidence

Context: wrong answers hurt trust. Decision: hybrid (vector + full-text) with RRF, mandatory citations, threshold-based escalation. Consequence: eval harness required.

## ADR-007 No AWS account: emulate with free tools, keep code cloud-portable

Context: no AWS access. Decision: S3 via MinIO or LocalStack, Lambda via SAM local or LocalStack, SQS via LocalStack or ElasticMQ, RDS replaced by Postgres container, Terraform run against LocalStack. All AWS access through AWS SDK v3 with `AWS_ENDPOINT_URL` env override. Consequence: code is portable; resumes must say "AWS-compatible, run on LocalStack/MinIO" unless real AWS is used.

## ADR-008 Kubernetes via kind (local)

Context: free and reproducible. Decision: kind cluster with Kustomize overlays. Consequence: no cloud load balancer; use Ingress-NGINX with port mapping.

## ADR-009 Mobile via Expo with EAS free tier

Decision: Expo Router app, EAS Build preview profile for Android, Fastlane lanes documented and runnable for Android; iOS signing optional because it needs a paid Apple account.

## ADR-010 Mock LLM in CI

Decision: provider interface with `mock`, `gemini`, `openai` implementations. CI uses `mock`; local evals use a real provider.

## ADR-011 Streaming AI answers and cache-driven UI

Decision: add `/v1/answer/stream` (SSE) and `message:stream` socket events; server data lives only in the query cache and socket events update it; semantic-cache keys include `kbVersion`. Consequence: UI renders append-only tokens, needs dedupe by `clientId` and `seq`. See `15-frontend-data-flow-and-latency.md`.
