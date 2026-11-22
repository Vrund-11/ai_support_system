# SupportPilot API Contracts Specification

Conventions:

- Base path: `/api/v1` for REST endpoints
- Casing: JSON `camelCase` request and response payloads
- Pagination: Keyset/cursor-based pagination `?limit=25&cursor=...` returning `{ data: [...], nextCursor: "..." }`
- Error Format: RFC 7807 Problem Details `{ type, title, status, detail, instance }`
- Idempotency: `Idempotency-Key` header on ticket creation and payment operations
- Tracing & Tenant Context: `X-Request-Id` and `X-Tenant-Id` headers echoed across microservices
- Machine-Readable OpenAPI Contracts: Exported in `docs/api/`
  - Ticket Service OpenAPI: `docs/api/ticket-service-openapi.json`
  - AI Service OpenAPI: `docs/api/ai-service-openapi.json`
  - Root API Spec: `docs/api/openapi.json`

---

## 1. Authentication & Tenant Identity

All authentication flows are hosted on Gateway / Ticket Service with token issuance and Redis-backed refresh token rotation.

| Method | Path                           | Auth / Role   | Request Payload                         | Response Payload                      | Description                                                                                                    |
| ------ | ------------------------------ | ------------- | --------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/auth/register`        | Public        | `{ tenantName, name, email, password }` | `{ user, accessToken, refreshToken }` | Provisions new isolated tenant, owner user, default SLA rules, and seed categories.                            |
| `POST` | `/api/v1/auth/login`           | Public        | `{ email, password }`                   | `{ user, accessToken, refreshToken }` | Authenticates user; issues 15-minute access token and 7-day single-use refresh token.                          |
| `POST` | `/api/v1/auth/refresh`         | Public        | `{ refreshToken }`                      | `{ accessToken, refreshToken }`       | Rotates refresh token in Redis (`rt:{userId}:{tokenId}`); revokes old token; triggers security alert on reuse. |
| `POST` | `/api/v1/auth/logout`          | Authenticated | `{ refreshToken }`                      | `204 No Content`                      | Revokes active refresh token from Redis.                                                                       |
| `POST` | `/api/v1/auth/forgot-password` | Public        | `{ email }`                             | `204 No Content`                      | Dispatches password reset token via notification-service.                                                      |
| `POST` | `/api/v1/auth/reset-password`  | Public        | `{ token, newPassword }`                | `204 No Content`                      | Resets password after verifying signed token.                                                                  |

---

## 2. Ticket Management & Lifecycle (Ticket Service :4001)

| Method  | Path                           | Auth / Role                | Description                                                                                                                                         |
| ------- | ------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/tickets`              | AGENT, LEAD, OWNER         | Keyset-paginated ticket list. Filters: `status`, `priority`, `assigneeId`, `tag`, `q`, `from`, `to`.                                                |
| `POST`  | `/api/v1/tickets`              | AGENT, LEAD, OWNER, System | Creates ticket. Accepts `subject`, `description`, `customerId`, `priority`, `tags`, `customFields`. Enforces sequential numbering via Redis `INCR`. |
| `GET`   | `/api/v1/tickets/:id`          | AGENT, LEAD, OWNER         | Retrieves ticket details and associated audit timeline events.                                                                                      |
| `PATCH` | `/api/v1/tickets/:id`          | AGENT, LEAD, OWNER         | Updates status, priority, or assignment. Requires `version` field for optimistic concurrency (returns `409 Conflict` on race).                      |
| `POST`  | `/api/v1/tickets/:id/messages` | AGENT, LEAD, OWNER         | Adds public customer reply or internal note (`isInternal: true`).                                                                                   |
| `POST`  | `/api/v1/tickets/bulk`         | LEAD, OWNER                | Performs batch status transition, tag addition, or agent assignment across `ticketIds[]`.                                                           |

---

## 3. Knowledge Base & AI Assist (AI Service :8000)

| Method | Path                       | Auth / Role        | Description                                                                                                                                                           |
| ------ | -------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/v1/answer`               | Gateway / Internal | Hybrid RAG retrieval (pgvector HNSW cosine similarity + BM25 tsvector) with Reciprocal Rank Fusion ($k=60$), structured prompt guardrails, and citation verification. |
| `POST` | `/v1/answer/stream`        | Gateway / Internal | Server-Sent Events (SSE) streaming draft tokens for responsive typing preview.                                                                                        |
| `POST` | `/v1/classify`             | Gateway / Internal | TF-IDF + LogisticRegression / LinearSVC classifier predicting priority and category with keyword fallback rules.                                                      |
| `POST` | `/v1/assist/suggest-reply` | AGENT, LEAD, OWNER | Generates contextual suggested responses based on ticket history and KB context.                                                                                      |
| `POST` | `/v1/assist/summarize`     | AGENT, LEAD, OWNER | Generates concise thread summary and sentiment assessment for rapid handoff.                                                                                          |
| `POST` | `/v1/ingest`               | LEAD, OWNER        | Chunks Markdown/text documents, generates 384-dimensional dense vectors via SBERT, and indexes into PostgreSQL pgvector HNSW table.                                   |

---

## 4. Real-Time Communication & Chat Widget (Gateway :4000)

### Socket.IO Protocol

Clients establish WebSocket connection to `http://localhost:4000` with JWT bearer token (Agent) or visitor token (Customer).

**Events Emitted by Server**:

- `message:received`: New message persisted in thread with monotonic `seq`.
- `message:stream`: Incremental token stream from AI assistant.
- `typing:update`: Real-time user typing status.
- `presence:update`: Agent/visitor online and idle state.
- `ticket:updated`: Status or priority state change.

**Events Handled by Server**:

- `message:send`: Submits message payload `{ conversationId, content, attachments }`.
- `typing:start` / `typing:stop`: Broadcasts typing indicators to room.
- `conversation:join`: Subscribes to conversation room; accepts `lastSeq` to replay missed messages upon reconnect.

### Widget REST Fallback Endpoints

| Method | Path                      | Description                                                                            |
| ------ | ------------------------- | -------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/widget/session`  | Creates visitor session and returns theme configuration and short-lived visitor token. |
| `POST` | `/api/v1/widget/messages` | HTTP fallback for sending chat messages when WebSocket connection is unavailable.      |
| `POST` | `/api/v1/widget/offline`  | Submits offline contact form and generates support ticket when no agents are online.   |
| `POST` | `/api/v1/widget/csat`     | Submits customer satisfaction survey score (1-5) and feedback notes.                   |

---

## 5. GraphQL Schema Definition (Gateway Apollo Server :4000/graphql)

```graphql
scalar DateTime

enum TicketStatus {
  NEW
  OPEN
  PENDING_CUSTOMER
  ON_HOLD
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

type Ticket {
  id: ID!
  tenantId: ID!
  number: Int!
  subject: String!
  description: String!
  status: TicketStatus!
  priority: TicketPriority!
  assignee: User
  customer: Customer!
  messages: [Message!]!
  events: [TimelineEvent!]!
  version: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Message {
  id: ID!
  ticketId: ID!
  author: User
  content: String!
  isInternal: Boolean!
  attachments: [String!]
  createdAt: DateTime!
}

type User {
  id: ID!
  name: String!
  email: String!
  role: String!
}

type Customer {
  id: ID!
  name: String!
  email: String!
}

type Query {
  tickets(
    status: TicketStatus
    priority: TicketPriority
    limit: Int
    cursor: String
  ): TicketConnection!
  ticket(id: ID!): Ticket
  me: User!
}

type Mutation {
  createTicket(input: CreateTicketInput!): Ticket!
  updateTicket(id: ID!, input: UpdateTicketInput!): Ticket!
  addMessage(ticketId: ID!, content: String!, isInternal: Boolean): Message!
}

type Subscription {
  ticketUpdated(ticketId: ID!): Ticket!
  messageAdded(ticketId: ID!): Message!
}
```

---

## 6. Notification & Asynchronous Queues (Notification Service :5001)

Internal BullMQ queues managed over Redis:

1. `email`: Renders and delivers transactional notifications (invitations, SLA warnings, password resets).
2. `push`: Dispatches mobile agent notifications via Expo push service and FCM.
3. `webhook`: Signs HMAC-SHA256 payloads and posts to registered tenant webhook URLs with exponential backoff.
4. `sla`: Delayed BullMQ jobs checking 75% warning and 100% breach deadlines calculated during business hours.
5. `audit`: Records compliance and security events.
6. `dlq`: Captures permanently failed jobs after retry exhaustion for manual inspection and replay.
