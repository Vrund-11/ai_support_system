# Architecture and Repository Specification

## 1. Services and Network Ports

| Service                        | Port            | Runtime & Framework                               | Datastore / State Owned                                |
| ------------------------------ | --------------- | ------------------------------------------------- | ------------------------------------------------------ |
| **web** (Agent Dashboard)      | `5173`          | React 19 + Vite (TypeScript)                      | None (Stateless Client)                                |
| **widget** (Customer Portal)   | `5174`          | React 19 + Vite (TypeScript)                      | None (Stateless Client)                                |
| **mobile** (Agent App)         | Expo            | React Native + Expo Router                        | SQLite Outbox (Offline Cache)                          |
| **gateway**                    | `4000`          | Node.js 22 + Express 5, Apollo GraphQL, Socket.IO | Redis (Sessions, Rate Limits, Socket Adapter)          |
| **ticket-service**             | `4001`          | Node.js 22 + Express 5 + Mongoose                 | MongoDB 7 (Tenants, Users, Tickets, Events)            |
| **ai-service**                 | `8000`          | Python 3.12 + FastAPI + Pydantic                  | PostgreSQL 16 + pgvector (HNSW Index), Model Artifacts |
| **notification-service**       | `5001`          | Node.js 22 + BullMQ                               | Redis (Job Queues, Timers, Dead-Letter Queue)          |
| **webhook-lambda** (SAM Local) | `3001`          | Python 3.12 / Node.js Lambda Handler              | AWS SQS Queue / LocalStack Emulation                   |
| **MongoDB**                    | `27017`         | `mongo:7`                                         | Multi-Tenant Document Store                            |
| **PostgreSQL**                 | `5432`          | `pgvector/pgvector:pg16`                          | Relational Store, Vector Embeddings (HNSW)             |
| **Redis**                      | `6379`          | `redis:7`                                         | In-Memory Cache, BullMQ Queues, Socket.IO Pub/Sub      |
| **MinIO**                      | `9000` / `9001` | S3-Compatible Storage Server                      | Object Storage (Tenant Uploads, Attachments)           |
| **MailHog**                    | `1025` / `8025` | SMTP Server / Inspection Web UI                   | Transactional Email Emulation                          |
| **Prometheus**                 | `9090`          | Prometheus v2.54                                  | Metrics Scraping & TSDB                                |
| **Grafana**                    | `3005`          | Grafana v11.1                                     | Observability Dashboards & Telemetry                   |

_Security Invariant_: Only the **gateway** (`:4000`) and frontends (`:5173`, `:5174`) are exposed to external clients. Direct internal microservice-to-microservice calls carry the shared `x-service-token` secret header.

---

## 2. Asynchronous Queues & Background Processing

All asynchronous operations are governed by BullMQ running on Redis within `notification-service` (:5001).
Queue names are standardized as:

1. **`email`**:
   - Concurrency: 5
   - Attempts: 3 with exponential backoff (`delay: 1000ms`)
   - Responsibilities: Verification emails, password resets, ticket assignment alerts, SLA breach notices via Nodemailer/MailHog.
2. **`push`**:
   - Concurrency: 5
   - Attempts: 3 with exponential backoff (`delay: 1000ms`)
   - Responsibilities: Mobile agent push notifications dispatched via Expo Push Notification API.
3. **`webhook`**:
   - Concurrency: 5
   - Attempts: 5 with exponential backoff (`delay: 2000ms`)
   - Responsibilities: HMAC-SHA256 signed HTTP webhooks sent to customer external endpoints.
4. **`sla`**:
   - Concurrency: 3
   - Attempts: 3 with fixed backoff (`delay: 5000ms`)
   - Responsibilities: Delayed timers tracking 75% SLA warning and 100% breach deadlines across tenant business hours.
5. **`audit`**:
   - Concurrency: 10
   - Attempts: 3 with fixed backoff (`delay: 2000ms`)
   - Responsibilities: Immutable logging of security events, role modifications, and tenant changes.
6. **`dlq`**:
   - Concurrency: 1
   - Attempts: 1
   - Responsibilities: Dead-letter queue capturing exhausted failures across all queues for manual triage, root cause analysis, and administrative replay.

---

## 3. AI & Knowledge Base Retrieval Architecture

### Embedding Provider: SBERT

- **Architecture**: Pluggable provider interface `EmbeddingProvider` defined in `apps/ai-service/src/embeddings.py`.
- **Runtime Provider**: `SbertProvider` utilizing `sentence-transformers/all-MiniLM-L6-v2`.
- **Dimensions**: 384-dimensional dense vectors, normalized with unit Euclidean length ($L_2 = 1.0$).
- **Metadata**: Every ingested chunk tracks `embedding_model = "sentence-transformers/all-MiniLM-L6-v2"` ensuring dimensional consistency during retrieval.

### Vector Storage & Indexing: PostgreSQL pgvector HNSW

- **Extension**: `pgvector` on PostgreSQL 16.
- **Index Type**: **Hierarchical Navigable Small World (HNSW)** with cosine distance operator `vector_cosine_ops`.
- **Index Definition**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding
      ON kb_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  ```
- **Query Hyperparameters**: Session runtime sets `SET hnsw.ef_search = 40;` to guarantee >98% recall at <5ms retrieval latency.
- **Hybrid Retrieval & RRF**:
  - Vector similarity candidates ($k=10$) merged with PostgreSQL Full-Text Search tsvector BM25 candidates ($k=10$).
  - Rank fusion calculated via Reciprocal Rank Fusion:
    $$\text{RRF}(d) = \sum_{m \in \{\text{vector}, \text{bm25}\}} \frac{1}{60 + r_m(d)}$$
  - Tenant boundary enforced at SQL level (`WHERE tenant_id = :tenant_id`).

---

## 4. Architectural Boundaries & Data Isolation

1. **Strict Tenant Scoping (`BaseTenantRepository`)**:
   - All database reads and writes in `ticket-service` inherit from `BaseTenantRepository<T>`.
   - Every MongoDB query automatically injects `{ tenantId }`.
   - Three intentional unscoped operations:
     1. Initial tenant registration (`registerTenant`)
     2. SuperAdmin system-wide tenant registry overview
     3. Microservice health and readiness probes (`/health`, `/ready`)
2. **Optimistic Concurrency Control**:
   - Ticket mutations enforce integer `version` field matching.
   - Concurrent updates detect collisions and return RFC 7807 `409 Conflict`.
3. **Monotonic Sequence Replay**:
   - Messages are assigned per-conversation sequential integers via Redis `INCR seq:{conversationId}`.
   - Clients reconnecting submit `lastSeq` to receive strictly ordered delta replays with zero duplicate messages.
