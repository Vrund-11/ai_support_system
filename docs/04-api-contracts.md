# API Contracts

Conventions: base path `/api/v1`, JSON camelCase, cursor pagination `?limit=25&cursor=...` returning `{ data, nextCursor }`, errors as RFC 7807 `{ type, title, status, detail, instance }`, `Idempotency-Key` header on ticket creation, `X-Request-Id` echoed.

## Auth

| Method | Path                      | Body                              | Returns                              |
| ------ | ------------------------- | --------------------------------- | ------------------------------------ |
| POST   | /auth/register            | tenantName, name, email, password | user, tokens                         |
| POST   | /auth/login               | email, password                   | accessToken (15m), refreshToken (7d) |
| POST   | /auth/refresh             | refreshToken                      | new pair (rotation; old revoked)     |
| POST   | /auth/logout              | refreshToken                      | 204                                  |
| POST   | /auth/forgot, /auth/reset | email / token+password            | 204                                  |

## Tickets (AGENT+)

| Method | Path                  | Notes                                                     |
| ------ | --------------------- | --------------------------------------------------------- |
| GET    | /tickets              | filters: status, priority, assigneeId, tag, q, from, to   |
| POST   | /tickets              | subject, description, customerId, priority?, attachments? |
| GET    | /tickets/:id          | includes events                                           |
| PATCH  | /tickets/:id          | requires `version`; 409 on mismatch; validates transition |
| POST   | /tickets/:id/messages | body, isInternal, attachments                             |
| POST   | /tickets/bulk         | ids[], action (assign                                     | tag | status), value |

## Widget (public with widget key or visitor token)

| Method | Path             | Notes                                          |
| ------ | ---------------- | ---------------------------------------------- |
| POST   | /widget/session  | returns visitorToken, tenant theme             |
| POST   | /widget/messages | body; falls back to HTTP if socket unavailable |
| POST   | /widget/offline  | name, email, message -> ticket                 |
| POST   | /widget/csat     | conversationId, score, comment                 |

## Knowledge base (OWNER, LEAD)

| Method | Path                | Notes                                                  |
| ------ | ------------------- | ------------------------------------------------------ |
| POST   | /kb/uploads/presign | filename, contentType, size -> url, key (5 min expiry) |
| POST   | /kb/documents       | key or pasted text -> 202 + document id                |
| GET    | /kb/documents       | status list                                            |
| DELETE | /kb/documents/:id   | removes chunks                                         |
| POST   | /kb/test            | question -> answer preview with citations              |

## Misc

`GET /analytics/overview?range=7d`, `POST /devices` (FCM token), `GET/PUT /settings`, `GET /health`, `GET /ready`.

## GraphQL SDL (gateway)

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
enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
enum Role {
  OWNER
  LEAD
  AGENT
  VIEWER
  PLATFORM_ADMIN
}
enum SenderType {
  CUSTOMER
  AI
  AGENT
  SYSTEM
}

type Customer {
  id: ID!
  email: String
  name: String
}
type Agent {
  id: ID!
  name: String!
  role: Role!
}
type Citation {
  chunkId: ID!
  docId: ID!
  title: String!
}
type Message {
  id: ID!
  seq: Int!
  senderType: SenderType!
  body: String!
  isInternal: Boolean!
  citations: [Citation!]!
  createdAt: DateTime!
}
type Ticket {
  id: ID!
  number: Int!
  subject: String!
  status: TicketStatus!
  priority: Priority!
  assignee: Agent
  customer: Customer!
  tags: [String!]!
  version: Int!
  messages(limit: Int, cursor: String): MessagePage!
  createdAt: DateTime!
  updatedAt: DateTime!
}
type MessagePage {
  items: [Message!]!
  nextCursor: String
}
type TicketPage {
  items: [Ticket!]!
  nextCursor: String
}
type AnalyticsOverview {
  open: Int!
  newToday: Int!
  medianFirstResponseMin: Float
  medianResolutionMin: Float
  deflectionRate: Float
  slaCompliance: Float
}

input TicketFilter {
  status: [TicketStatus!]
  priority: [Priority!]
  assigneeId: ID
  tag: String
  q: String
}
input UpdateTicketInput {
  status: TicketStatus
  priority: Priority
  assigneeId: ID
  tags: [String!]
  version: Int!
}

type Query {
  tickets(filter: TicketFilter, limit: Int = 25, cursor: String): TicketPage!
  ticket(id: ID!): Ticket
  analyticsOverview(rangeDays: Int = 7): AnalyticsOverview!
  me: Agent!
}
type Mutation {
  createTicket(subject: String!, description: String!, customerId: ID!): Ticket!
  updateTicket(id: ID!, input: UpdateTicketInput!): Ticket!
  addMessage(ticketId: ID!, body: String!, isInternal: Boolean = false): Message!
  assignTicket(id: ID!, agentId: ID!): Ticket!
  suggestReply(ticketId: ID!): String!
}
type Subscription {
  ticketUpdated: Ticket!
  messageAdded(ticketId: ID!): Message!
}
```

Controls: depth limit 8, complexity limit, DataLoader for assignee/customer, role directive `@auth(roles: [...])`.

## Socket.IO events

Handshake auth: `{ token }` (JWT or visitor token). Rooms: `t:{tenantId}`, `c:{conversationId}`, `u:{userId}`.

| Direction                                                                   | Event                      | Payload                                          |
| --------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| C->S                                                                        | conversation:join          | { conversationId, lastSeq? }                     |
| C->S                                                                        | message:send               | { conversationId, clientId, body, attachments? } |
| C->S                                                                        | typing:start / typing:stop | { conversationId }                               |
| C->S                                                                        | message:read               | { conversationId, upToSeq }                      |
| S->C                                                                        | message:new                | full message with seq                            |
| S->C                                                                        | message:ack                | { clientId, seq }                                |
| S->C                                                                        | conversation:state         | { conversationId, state }                        |
| S->C                                                                        | typing                     | { conversationId, who }                          |
| S->C                                                                        | presence:update            | { userId, status }                               |
| S->C                                                                        | ticket:updated             | ticket summary                                   |
| S->C                                                                        | notification:new           | { type, ticketId, text }                         |
| S->C                                                                        | kb:ingestion               | { documentId, status }                           |
| Replay: on join with `lastSeq`, server sends all missing messages in order. |

## Internal AI service (FastAPI, `x-service-token` required)

```
POST /v1/answer      { tenantId, conversationId, question, history[] }
  -> { answer, citations[{chunkId,docId,title}], confidence, shouldEscalate, cacheHit, usage }
POST /v1/classify    { subject, body } -> { priority, category, probabilities }
POST /v1/ingest      { tenantId, documentId } -> 202
GET  /v1/ingest/{id} -> { status, error? }
POST /v1/suggest-reply { tenantId, ticketId, messages[] } -> { suggestion, citations[] }
POST /v1/summarize   { messages[] } -> { summary }
GET  /healthz, /readyz
```

## Webhook contract (outgoing)

Headers: `X-SupportPilot-Event`, `X-SupportPilot-Signature: sha256=<hex hmac of raw body>`, `X-SupportPilot-Delivery`. Events: `ticket.created`, `ticket.updated`, `message.created`. Retries with exponential backoff up to 6 attempts, then DLQ.
