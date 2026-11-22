# SupportPilot Technical Interview Walkthrough Guide

This document is an architectural field guide designed for deep-dive technical interviews. For each of the 15 core architectural systems, it provides the exact source file, primary function, a 60-second explanation, and implementation nuances.

---

## 1. Multi-Tenant Data Isolation

- **File**: `apps/ticket-service/src/repositories/base.repository.ts`
- **Key Function**: `BaseTenantRepository.scopeFilter(filter)`
- **60-Second Explanation**:
  Every database operation in `ticket-service` inherits from `BaseTenantRepository<T>`. When any query (`find`, `findOne`, `updateOne`, `deleteMany`) is executed, `scopeFilter()` wraps the incoming query predicate with `{ ...filter, tenantId }`. By binding `tenantId` at the lowest repository abstraction layer, higher-level route handlers and business services cannot accidentally execute cross-tenant queries. This guarantee is validated by property-based and automated cross-tenant security test suites.
- **The 3 Intentional Unscoped Operations & Why**:
  1. `registerTenant()`: Creates the initial tenant document and owner account before a `tenantId` context exists.
  2. SuperAdmin System Metrics: Reads aggregated fleet-wide analytics across tenants for platform cockpit telemetry.
  3. Service Health & Readiness Probes (`/health`, `/ready`): Validates database connectivity without customer context.

---

## 2. Authentication, Token Rotation & Reuse Detection

- **File**: `apps/ticket-service/src/services/auth.service.ts`
- **Key Function**: `rotateRefreshToken(oldRefreshToken)`
- **60-Second Explanation**:
  Authentication issues a 15-minute stateless JWT access token and a 7-day single-use cryptographically random refresh token. The refresh token ID is indexed in Redis at `rt:{userId}:{tokenId}`. When an agent requests a token refresh, the server checks Redis in an atomic pipeline. If the token ID exists and is valid, the old key is immediately deleted, and a new token pair is issued. If a client attempts to exchange an already-revoked refresh token, the server identifies token theft (replay), immediately invalidates _all_ active refresh tokens for that user ID, logs a security audit event, and returns HTTP 401.

---

## 3. RBAC Middleware & Deny-by-Default Permission Matrix

- **File**: `packages/shared-lib/src/middleware/rbac.middleware.ts`
- **Key Function**: `requirePermission(permission)`
- **60-Second Explanation**:
  Role-Based Access Control operates on a strict deny-by-default architecture. SupportPilot defines four distinct roles: `AGENT`, `LEAD`, `OWNER`, and `SUPERADMIN`. Permissions are categorized as granular verbs (e.g. `tickets:read`, `tickets:update`, `settings:manage`, `audit:read`). The RBAC middleware extracts the authenticated user role from JWT claims, verifies the tenant boundary, and checks membership against a static frozen permission map. If a route lacks explicit authorization or the role lacks the required claim, the middleware immediately rejects the request with RFC 7807 `403 Forbidden`.

---

## 4. Optimistic Concurrency Control (Version & 409 Handling)

- **File**: `apps/ticket-service/src/repositories/ticket.repository.ts`
- **Key Function**: `TicketRepository.updateWithVersion(id, tenantId, updateData, currentVersion)`
- **60-Second Explanation**:
  To prevent "last-write-wins" race conditions when multiple agents simultaneously triage a ticket, the `Ticket` schema incorporates an integer `version` property. When updating a ticket, the repository executes:
  ```javascript
  this.model.findOneAndUpdate(
    { _id: id, tenantId, version: currentVersion },
    { $set: updateData, $inc: { version: 1 } },
    { new: true },
  );
  ```
  If another agent modified the ticket in the interim, the version does not match, returning `null`. The controller detects this zero-match condition and throws an HTTP `409 Conflict`. On the frontend, TanStack Query catches the 409, displays a collision notification, and prompts the agent to view incoming changes.

---

## 5. Sequential Ticket Numbering with Redis INCR & Recovery

- **File**: `apps/ticket-service/src/repositories/ticket.repository.ts`
- **Key Function**: `TicketRepository.getNextTicketNumber(tenantId)`
- **60-Second Explanation**:
  Customers expect human-friendly ticket numbers (`#1001`, `#1002`) isolated per tenant. SupportPilot uses atomic Redis counters `ticket:seq:{tenantId}` via `redis.incr()`. In the event of a Redis cache flush or restart, the repository executes a cold-start recovery query: it queries MongoDB for `{ tenantId }`, sorts descending by `number`, finds the highest existing integer, and primes the Redis key with `SET ticket:seq:{tenantId} <maxNumber>`. In addition, MongoDB enforces a compound unique index on `{ tenantId: 1, number: 1 }` as the ultimate database-level safeguard against collisions.

---

## 6. Business-Hours SLA Engine & Delayed Timer Jobs

- **File**: `apps/notification-service/src/workers/sla.worker.ts` & `packages/shared-lib/src/lib/sla-calculator.ts`
- **Key Function**: `calculateSlaDeadline(createdAt, priority, tenantWorkingHours)`
- **60-Second Explanation**:
  SLA deadlines are computed strictly against tenant operating schedules (e.g. Monday-Friday 09:00-18:00 UTC), skipping non-working hours, weekends, and holidays. Once calculated, `notification-service` schedules two BullMQ delayed jobs: a 75% warning job and a 100% breach job. When the timer job fires, the worker checks ticket state in MongoDB. If the ticket has already been resolved or closed, the event is safely discarded. If still open, the worker flags `isBreached: true`, writes a timeline event, and triggers urgent notification dispatch.

---

## 7. BullMQ Asynchronous Queues, Backoff, DLQ & Idempotency

- **File**: `apps/notification-service/src/manager.ts` & `apps/notification-service/src/queues.ts`
- **Key Function**: `QueueManager.registerWorker(queueName, processor)`
- **60-Second Explanation**:
  Asynchronous tasks run through 6 standardized BullMQ queues: `email`, `push`, `webhook`, `sla`, `audit`, and `dlq`. Each queue configures exponential backoff retry policies (e.g., webhook jobs retry 5 times: 2s, 4s, 8s, 16s, 32s). Job processors enforce idempotency by recording processed event IDs in Redis (`job:idemp:{eventId}`) with a 24-hour TTL. When all retry attempts are exhausted, BullMQ's failed event listener automatically migrates the job payload and stack trace into the `dlq` queue for monitoring and administrative replay.

---

## 8. Real-Time Socket.IO Architecture & Sequence Replay

- **File**: `apps/gateway/src/socket.ts`
- **Key Function**: `handleConversationJoin(socket, conversationId, lastSeq)`
- **60-Second Explanation**:
  The API Gateway hosts Socket.IO clustered across instances using `@socket.io/redis-adapter` for inter-process pub/sub broadcast. Every message in a thread is assigned a monotonic per-conversation sequence integer via Redis `INCR seq:{conversationId}`. When client connections drop due to network jitter, the client reconnects and transmits its highest known `lastSeq`. The gateway queries MongoDB for `{ conversationId, seq: { $gt: lastSeq } }`, replaying missed messages in exact order before re-joining the live Redis room.

---

## 9. GraphQL Layer: Apollo Server, DataLoader Batching & Complexity Limits

- **File**: `apps/gateway/src/graphql/schema.ts` & `apps/gateway/src/graphql/dataloaders.ts`
- **Key Function**: `createDataLoaders(serviceToken)`
- **60-Second Explanation**:
  The Gateway provides an Apollo Server GraphQL endpoint tailored for the web dashboard. To solve the classic $N+1$ query problem when fetching tickets and their associated customer profiles or message authors, DataLoader batches discrete ID lookups into a single `POST /internal/users/batch` request per tick of the Node.js event loop. Furthermore, query complexity and depth analyzers reject nested queries exceeding a depth threshold of 5 levels to defend against resource exhaustion DoS attacks.

---

## 10. Hybrid Knowledge Base Retrieval & Reciprocal Rank Fusion (RRF)

- **File**: `apps/ai-service/src/retrieval/hybrid.py`
- **Key Function**: `hybrid_search(tenant_id, query, k=10)`
- **60-Second Explanation**:
  Hybrid retrieval combines dense semantic vector search with lexical BM25 full-text search:
  1. Dense Search: SBERT (`all-MiniLM-L6-v2`) generates 384d vectors queried against PostgreSQL `kb_chunks` via HNSW cosine distance (`vector_cosine_ops`).
  2. Sparse Search: PostgreSQL `to_tsquery('english', ...)` matches keywords against indexed Markdown text.
  3. Fusion: Results are combined using Reciprocal Rank Fusion:
     $$\text{RRF}(d) = \sum_{m} \frac{1}{60 + r_m(d)}$$
     We choose $k=60$ because it dampens the outlier effect of high-ranking documents from a single modality, ensuring chunks supported by both semantic meaning and exact keyword matches float to the top.

---

## 11. RAG Guardrails: Citation Verification & Calibrated Escalation

- **File**: `apps/ai-service/src/rag/service.py`
- **Key Function**: `RagService.generate_answer(tenant_id, question)`
- **60-Second Explanation**:
  To prevent hallucinations in customer support, SupportPilot enforces strict guardrails:
  1. Context Injection Defense: Queries pass through regex sanitization and system prompt delimiters (`<user_inquiry>`) instructing the LLM to ignore system overrides.
  2. Structured Output & JSON Repair: LLM generates a strict JSON schema (`answer`, `citations`, `confidence`). If the JSON is malformed, an AST regex repair utility extracts valid objects.
  3. Citation Verification: The service verifies cited chunk IDs against the actual chunks retrieved in step 10. Any fabricated citation drops confidence score to 0.0.
  4. Automatic Escalation: If confidence falls below 0.70 or the query matches escalation keywords, the service returns `shouldEscalate: true`, transitions ticket status to `WAITING_AGENT`, and alerts on-duty agents.

---

## 12. Ticket Priority & Category Classifier (ML Pipeline)

- **File**: `apps/ai-service/src/classifier/service.py` & `src/classifier/train.py`
- **Key Function**: `ClassifierService.classify(subject, description)`
- **60-Second Explanation**:
  Ticket routing uses a scikit-learn model trained on 600 multi-category tickets. We chose TF-IDF (1-2 word n-grams) coupled with LogisticRegression / LinearSVC because it yields exceptional inference speed (< 5ms), low memory footprint (< 175KB joblib artifact), and strong macro-F1 (0.9610 overall, 1.0000 category, 0.9220 priority). If the model confidence is low or the input text contains explicit urgent outage indicators (e.g. "payment gateway down"), a deterministic keyword rule engine acts as an instant fallback.

---

## 13. Presigned File Uploads & Magic-Byte Validation

- **File**: `apps/ticket-service/src/routes/upload.routes.ts`
- **Key Function**: `validateMagicBytes(buffer, declaredMimeType)`
- **60-Second Explanation**:
  File attachments upload directly to S3/MinIO via presigned PUT URLs, preventing file upload payloads from overwhelming API gateway memory. Before issuing presigned URLs or finalizing attachment records, client-submitted file headers are audited:
  - File extension checks are strictly rejected as insufficient.
  - The service inspects the initial 4 to 8 bytes ("magic numbers") of the binary buffer (e.g. `89 50 4E 47` for PNG, `25 50 44 46` for PDF).
  - Storage paths are strictly partitioned by tenant: `${tenantId}/${purpose}/${uuid}-${filename}` to eliminate cross-tenant file tampering.

---

## 14. Kubernetes Architecture: Probes, HPA, NetworkPolicy & Kind

- **File**: `infra/k8s/base/`
- **Key File**: `infra/k8s/base/networkpolicy.yaml` & `infra/k8s/kind-config.yaml`
- **60-Second Explanation**:
  The microservice fleet runs in Kubernetes configured via Kustomize:
  - Pod Health: Every deployment configures `/health` liveness probes and `/ready` readiness probes.
  - Horizontal Autoscaling: Gateway and ticket-service configure HPAs scaling between 2 and 5 replicas on 75% target CPU utilization.
  - NetworkPolicy Zero-Trust: A namespace-wide `default-deny-ingress` blocks unauthorized pod-to-pod communication. Gateway can only talk to internal service ports; direct external ingress to internal databases or workers is dropped.
  - Why Kind: Kind enables 100% reproducible multi-node local cluster testing and Ingress NGINX validation in free CI runners without incurring cloud billings.

---

## 15. AWS Production Migration & Top 5 Known Weaknesses

### Production AWS Architecture

If migrating from local emulation to enterprise AWS:

1. Datastores: MongoDB -> Amazon DocumentDB (or MongoDB Atlas on AWS); PostgreSQL pgvector -> Amazon Aurora PostgreSQL with pgvector; Redis -> Amazon ElastiCache for Redis (Cluster Mode).
2. Compute: Microservices -> Amazon EKS (Fargate or managed node groups); Webhook dispatcher -> native AWS Lambda.
3. Queueing & Storage: MinIO -> Amazon S3 with S3 Object Lock and KMS SSE-KMS; BullMQ/Redis -> Amazon SQS FIFO + Amazon EventBridge.
4. Secrets & Ingress: Local secrets -> AWS Secrets Manager with KMS automatic rotation; Kind Ingress -> AWS Application Load Balancer (ALB) with AWS WAF rate limiting and shield protection.

### Top 5 Known Architectural Weaknesses & Remediation

1. **Weakness: Single-Region Datastore Bottlenecks**
   - _Issue_: MongoDB and PostgreSQL pgvector run as primary-replica sets in a single availability zone/region.
   - _Fix_: Migrate to Aurora PostgreSQL Global Database with cross-region read replicas and MongoDB Atlas multi-region clusters for disaster recovery.

2. **Weakness: BullMQ Redis Memory Pressure at Extreme Scale**
   - _Issue_: High-volume notification events stored in Redis memory can cause RAM exhaustion if consumers lag.
   - _Fix_: Offload high-throughput asynchronous job storage to native Amazon SQS FIFO or Kafka (Amazon MSK), reserving Redis strictly for ephemeral presence and caching.

3. **Weakness: Static Cold Classifier Training**
   - _Issue_: The priority classifier relies on a static 600-sample joblib artifact trained offline.
   - _Fix_: Implement an automated continuous learning pipeline where agent ticket edits and reclassifications write to an active dataset queue, triggering weekly retraining jobs with shadow deployment verification.

4. **Weakness: SSE AI Stream Client Interruption Handling**
   - _Issue_: If an agent abruptly closes the browser tab during `/v1/answer/stream`, the backend aborts generation without persisting partial drafts.
   - _Fix_: Buffer stream chunks in Redis Pub/Sub; upon disconnection, persist the partial generation with an `interrupted` flag so agents can resume upon reconnect.

5. **Weakness: Lack of Distributed Tracing Propagation across Outbound Webhooks**
   - _Issue_: While internal services propagate W3C `traceparent` headers, outbound customer webhooks do not include external correlation headers.
   - _Fix_: Standardize `X-Trace-Id` and OpenTelemetry context injection across outbound webhook delivery payloads to allow end-to-end trace correlation with customer telemetry.
