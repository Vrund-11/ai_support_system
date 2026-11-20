# SupportPilot: Product Requirements Document

Author: Vrund Upadhyay | Version 1.0 | Status: Draft | Date: 19 November 2026

## 1. Overview

### 1.1 Summary

SupportPilot is a multi-tenant, AI-assisted customer-support platform. Businesses (tenants) embed a chat widget on their site, customers get instant answers from an AI assistant grounded in the tenant's own documents (RAG), and anything the AI cannot resolve is handed to human agents who work from a web dashboard and a mobile app. It includes ticketing, live chat, a knowledge base, SLA automation, analytics and an integration API.

### 1.2 Problem

Small and mid-size businesses answer the same questions repeatedly, lose tickets across email and chat, and cannot afford enterprise help desks. Agents waste time triaging, and customers wait for answers that already exist in documentation.

### 1.3 Product goals

- Deflect repetitive questions with grounded, cited AI answers.
- Give agents one inbox for chat and tickets with real-time updates.
- Auto-classify and prioritise tickets so urgent issues surface first.
- Give each tenant isolated data, roles and branding.
- Give owners analytics on volume, response time, AI deflection and SLA compliance.

### 1.4 Personal learning and career goals (the real purpose of this build)

This project exists to make every skill on my resumes real and defensible. Each technology below must be used for an actual purpose in the system, not decoration.

- MERN stack, MongoDB aggregation pipelines, Mongoose indexing.
- GraphQL (Apollo), REST, WebSockets (Socket.IO), BullMQ queues.
- Microservices (3 services plus gateway), Docker, Kubernetes, GitHub Actions CI/CD.
- AWS: S3, EC2 or ECS, RDS (Postgres with pgvector), Lambda.
- GenAI: embeddings, vector search, RAG, structured LLM output, evaluation.
- AI/ML: a trained ticket-priority classifier served by FastAPI.
- Mobile: Expo React Native for iOS and Android, FCM push, EAS Build, Fastlane.
- Testing: Jest, Vitest, Cypress, Playwright, Supertest, k6, Postman/Newman.
- Agile and product practice: this PRD, sprints, a backlog, retrospectives.

### 1.5 Non-goals (v1)

- Voice or video calling, email-to-ticket ingestion, billing with real payments, multi-language UI, SSO/SAML, on-prem deployment.

### 1.6 Success metrics (targets; record real measured values)

| Metric                                   | Target                                            | How measured                       |
| ---------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| AI answer groundedness on eval set       | at least 85% of answers supported by cited chunks | offline eval script, 100 Q&A pairs |
| Priority classifier macro-F1             | at least 0.80                                     | held-out test set                  |
| Chat message delivery p95                | under 300 ms (local and staging)                  | k6 plus Socket.IO test             |
| Ticket list API p95 at 200 virtual users | under 400 ms                                      | k6                                 |
| Automated test coverage (services)       | at least 80% lines                                | Jest/Vitest coverage reports       |
| CI pipeline duration                     | under 12 minutes                                  | GitHub Actions                     |
| Deploy to staging                        | one command or one merge                          | pipeline                           |

These are targets, not claims. Resume numbers must come only from measured results.

## 2. Users and personas

| Persona        | Description                    | Key needs                                                         |
| -------------- | ------------------------------ | ----------------------------------------------------------------- |
| Customer       | End user of a tenant's product | Fast answers, no login for first chat, ticket status, attachments |
| Agent          | Support staff                  | Unified inbox, canned replies, AI suggestions, mobile push        |
| Team Lead      | Manages agents                 | Assignment rules, SLA view, reassignment, reports                 |
| Tenant Owner   | Business owner                 | Branding, KB management, users, plan limits, analytics            |
| Platform Admin | Me (operator)                  | Tenant management, usage, health, feature flags                   |
| Integrator     | Developer at tenant            | API keys, webhooks, widget embed snippet                          |

## 3. Scope and prioritisation

- **P0 (MVP):** auth, tenancy, ticketing, live chat, KB with RAG answers, agent inbox, notifications, basic analytics, Docker deployment.
- **P1:** classifier-based priority, SLA automation, mobile agent app, GraphQL gateway, Kubernetes deployment, CI/CD, load tests.
- **P2:** canned replies and macros, webhooks, API keys, CSAT survey, audit log UI, feature flags.

## 4. Functional requirements

### 4.1 Authentication and accounts (AUTH)

- AUTH-1 (P0): Email and password sign-up and login for tenant users with bcrypt hashing.
- AUTH-2 (P0): JWT access token (15 min) and rotating refresh token (7 days) stored hashed in Redis; logout revokes the session.
- AUTH-3 (P0): Role-based access control with roles OWNER, LEAD, AGENT, VIEWER, plus PLATFORM\_ADMIN.
- AUTH-4 (P1): Email verification and password reset with expiring single-use tokens.
- AUTH-5 (P1): Rate limiting on login (5 attempts per 15 minutes per IP and per account, exponential backoff).
- AUTH-6 (P2): OAuth 2.0 login with Google.
- AUTH-7 (P0): Anonymous customer sessions for the widget, identified by a signed visitor token, upgradable to a known customer by email.

### 4.2 Tenancy (TEN)

- TEN-1 (P0): Every record carries tenantId; every query is scoped by it at the data-access layer, not just in controllers.
- TEN-2 (P0): Tenant onboarding creates the owner user, default roles, a default KB and a widget key.
- TEN-3 (P1): Per-tenant settings: brand colour, logo, business hours, SLA policy, AI on or off, AI confidence threshold.
- TEN-4 (P1): Per-tenant rate limits and plan quotas (messages, KB size, AI calls per day).
- TEN-5 (P0): Automated test proving no cross-tenant data access through REST, GraphQL or sockets.

### 4.3 Tickets (TKT)

- TKT-1 (P0): Create ticket from widget, dashboard or API with subject, description, customer, channel, attachments.
- TKT-2 (P0): Status workflow: NEW, OPEN, PENDING\_CUSTOMER, ON\_HOLD, RESOLVED, CLOSED, with an allowed-transition map enforced in code and covered by tests.
- TKT-3 (P0): Priority LOW, MEDIUM, HIGH, URGENT; set manually or by the classifier.
- TKT-4 (P0): Assignment to an agent or team; manual, round-robin or least-loaded.
- TKT-5 (P0): Threaded conversation with public replies and internal notes.
- TKT-6 (P1): Tags, custom fields, merge duplicates, link related tickets.
- TKT-7 (P0): Search and filter by status, priority, assignee, tag, date range and free text (MongoDB text index).
- TKT-8 (P1): Bulk actions (assign, tag, close) for selected tickets.
- TKT-9 (P0): Optimistic concurrency using a version field to prevent lost updates.
- TKT-10 (P1): Full activity timeline for every ticket (who changed what and when).

### 4.4 Live chat (CHAT)

- CHAT-1 (P0): Embeddable widget (single script tag) opens a chat room with the AI first.
- CHAT-2 (P0): Real-time messaging over Socket.IO with rooms per conversation, delivery and read receipts.
- CHAT-3 (P0): Typing indicators and online presence for agents.
- CHAT-4 (P0): Handoff: if the AI confidence is below threshold, the customer asks for a human, or the topic is on a blocklist, the conversation is escalated and a ticket is created automatically with the transcript.
- CHAT-5 (P1): Offline messages: customers can leave a message outside business hours and it becomes a ticket.
- CHAT-6 (P1): Reconnection with message replay using per-conversation sequence numbers.
- CHAT-7 (P1): Socket.IO Redis adapter so multiple gateway instances share rooms.

### 4.4a Knowledge base (KB)

- KB-1 (P0): Tenants upload documents (PDF, Markdown, TXT) or paste articles; files go to S3 through presigned uploads.
- KB-2 (P0): Ingestion pipeline: extract text, clean, chunk (about 500 tokens, 80 overlap), embed, store vectors in Postgres pgvector with metadata (tenantId, docId, title, section, chunk index).
- KB-3 (P0): Re-ingestion on document update; old chunks replaced atomically.
- KB-4 (P1): Public help-center pages rendered from KB articles.
- KB-5 (P1): Ingestion status and failures visible in the dashboard.
- KB-6 (P2): Article feedback (helpful or not) feeding the eval set.

### 4.5 AI assistant (AI)

- AI-1 (P0): RAG answer: embed the question, retrieve top-k chunks for the tenant, rerank, generate an answer that must cite chunk ids.
- AI-2 (P0): Strict JSON output validated with Zod or Pydantic: answer, citations, confidence, shouldEscalate.
- AI-3 (P0): If retrieval score is below threshold, the assistant says it does not know and escalates instead of guessing.
- AI-4 (P1): Ticket priority and category classifier (see section 9).
- AI-5 (P1): Agent assist: suggested reply drafted from KB and conversation, one-click insert.
- AI-6 (P1): Conversation summary generated on handoff and on ticket close.
- AI-7 (P1): Semantic response cache in Redis keyed by tenant and normalised question embedding.
- AI-8 (P1): Per-tenant token and call quotas with graceful degradation to retrieval-only answers.
- AI-9 (P0): Prompt-injection defences: system prompt isolation, retrieved text treated as data, output validation, PII redaction in logs.
- AI-10 (P1): Offline evaluation harness and a regression gate in CI.

### 4.6 Automation and SLA (AUTO)

- AUTO-1 (P1): SLA policies per priority (first response time, resolution time) using business hours.
- AUTO-2 (P1): BullMQ delayed jobs raise warnings at 75% and breach events at 100%.
- AUTO-3 (P1): Rules engine: when condition (status, priority, tag, keyword) then action (assign, tag, notify, escalate).
- AUTO-4 (P2): Auto-close tickets pending customer reply after N days.
- AUTO-5 (P2): Canned replies with variables.

### 4.7 Notifications (NOTIF)

- NOTIF-1 (P0): In-app real-time notifications over Socket.IO.
- NOTIF-2 (P1): Mobile push via Firebase Cloud Messaging with device-token registration and cleanup of invalid tokens.
- NOTIF-3 (P1): Email via a transactional provider (Resend) for verification, resets and ticket updates.
- NOTIF-4 (P1): Per-user notification preferences.
- NOTIF-5 (P0): Notification service is queue-driven (BullMQ), with retries, backoff and a dead-letter queue.

### 4.8 Analytics (ANL)

- ANL-1 (P0): Dashboard cards: open tickets, new today, median first response, median resolution.
- ANL-2 (P1): MongoDB aggregation pipelines for volume over time, by channel, by priority, by agent.
- ANL-3 (P1): AI metrics: deflection rate, escalation rate, average confidence, cost per conversation.
- ANL-4 (P1): SLA compliance chart.
- ANL-5 (P2): CSV export; scheduled weekly summary email.

### 4.9 Integrations and API (INT)

- INT-1 (P2): Tenant API keys (hashed) with scopes.
- INT-2 (P2): Outgoing webhooks (ticket.created, ticket.updated, message.created) signed with HMAC-SHA256, retried with backoff; delivery handled by an AWS Lambda function.
- INT-3 (P0): Public OpenAPI/Swagger docs for REST; GraphQL playground in non-production.

### 4.10 Administration (ADM)

- ADM-1 (P1): Platform admin console: tenants, usage, health, suspend tenant.
- ADM-2 (P1): Audit log (Postgres) of security-relevant actions.
- ADM-3 (P2): Feature flags per tenant.

### 4.11 Mobile agent app (MOB)

Detailed in section 10.

## 5. System architecture

### 5.1 Services

| Service              | Responsibility                                                                                                            | Stack                             | Datastore                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------- |
| gateway-api          | Single entry for web and mobile; GraphQL (Apollo Server) and REST; auth, rate limiting, request routing; Socket.IO server | Node, Express, TypeScript, Apollo | Redis                      |
| ticket-service       | Tickets, conversations, users, tenants, analytics aggregates                                                              | Node, Express, Mongoose           | MongoDB                    |
| ai-service           | Ingestion, embeddings, retrieval, RAG, classifier serving                                                                 | Python, FastAPI                   | Postgres + pgvector, Redis |
| notification-service | Queue consumers for push, email, webhooks, SLA timers                                                                     | Node, BullMQ                      | Redis, Postgres (audit)    |
| web-dashboard        | Agent, lead and owner UI                                                                                                  | React 19, Vite, TypeScript        | none                       |
| widget               | Embeddable chat widget                                                                                                    | React, Vite library build         | none                       |
| mobile-app           | Agent app for iOS and Android                                                                                             | Expo React Native                 | local secure storage       |
| webhook-lambda       | Signed webhook delivery                                                                                                   | AWS Lambda (Node)                 | none                       |

### 5.2 Communication

- Client to gateway: HTTPS (GraphQL for dashboard data, REST for widget and webhooks) and WebSocket (Socket.IO).
- Gateway to services: internal REST over the cluster network with a service token header; no service is exposed publicly except the gateway.
- Async work: BullMQ queues in Redis: ingestion, ai-reply, notifications, sla-timers, webhooks.
- Events: services publish domain events to a Redis stream; consumers update read models.

### 5.3 Core flows

1. Customer message: widget to gateway (socket) to ticket-service (persist) to ai-service (answer) to gateway to widget; if escalated, ticket-service sets handoff state and notifies agents.
2. Document ingestion: dashboard requests presigned S3 URL, uploads file, gateway enqueues ingestion job, ai-service chunks and embeds, writes vectors, reports status.
3. SLA: ticket creation schedules delayed BullMQ jobs; jobs check state before firing so closed tickets never alert.

### 5.4 Environments

Local (docker-compose), CI (ephemeral containers), staging (Kubernetes on kind or a small cloud cluster), production-like demo (AWS: EC2 or ECS, RDS, S3, Lambda).

## 6. Technology stack

| Area      | Choice                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Languages | TypeScript, Python 3.12                                                                                      |
| Web       | React 19, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, Apollo Client                           |
| Backend   | Node 22, Express, Apollo Server, Socket.IO, BullMQ, Zod                                                      |
| AI        | FastAPI, sentence-transformers (embeddings), scikit-learn, Gemini or OpenAI API, jsonrepair-style validation |
| Databases | MongoDB Atlas (Mongoose), PostgreSQL 16 with pgvector on RDS, Redis 7                                        |
| Cloud     | AWS S3, EC2 or ECS, RDS, Lambda, CloudWatch                                                                  |
| DevOps    | Docker, docker-compose, Kubernetes (kind locally), Helm or Kustomize, GitHub Actions                         |
| Mobile    | Expo (SDK current), Expo Router, FCM, EAS Build, Fastlane                                                    |
| Testing   | Jest, Vitest, Supertest, Cypress, Playwright, k6, Postman/Newman, fast-check                                 |
| Quality   | ESLint, Prettier, Husky, TypeScript strict, Ruff and pytest for Python                                       |

## 7. Data model

### 7.1 MongoDB collections (ticket-service)

- **tenants:** \_id, name, slug, plan, settings{brand, hours, sla, aiEnabled, aiThreshold}, createdAt.
- **users:** \_id, tenantId, email, passwordHash, role, name, status, lastLoginAt, deviceTokens\[\].
- **customers:** \_id, tenantId, email, name, externalId, visitorIds\[\], createdAt.
- **conversations:** \_id, tenantId, customerId, channel, state (AI, WAITING\_AGENT, WITH\_AGENT, CLOSED), assignedTo, lastSeq, ticketId, createdAt.
- **messages:** \_id, tenantId, conversationId, seq, senderType (CUSTOMER, AI, AGENT, SYSTEM), senderId, body, citations\[\], attachments\[\], isInternal, createdAt.
- **tickets:** \_id, tenantId, number, subject, status, priority, category, assigneeId, customerId, conversationId, tags\[\], customFields, sla{firstResponseDue, resolveDue, breached}, version, createdAt, updatedAt.
- **ticket\_events:** \_id, tenantId, ticketId, actorId, type, from, to, at.
- **canned\_replies, rules, api\_keys, webhooks:** tenant-scoped config collections.

Indexes: compound (tenantId, status, priority, updatedAt); (tenantId, assigneeId, status); (tenantId, number) unique; text index on tickets.subject and messages.body; (conversationId, seq) unique; TTL index on anonymous visitor sessions.

### 7.2 PostgreSQL (ai-service and notification-service)

- **kb\_documents:** id, tenant\_id, title, source, s3\_key, status, version, created\_at.
- **kb\_chunks:** id, tenant\_id, document\_id, chunk\_index, content, embedding vector(384), metadata jsonb. Index: HNSW on embedding, btree on tenant\_id.
- **ai\_usage:** id, tenant\_id, conversation\_id, model, prompt\_tokens, completion\_tokens, latency\_ms, cache\_hit, created\_at.
- **ai\_eval\_runs:** id, commit\_sha, groundedness, answer\_relevance, p95\_latency\_ms, created\_at.
- **audit\_log:** id, tenant\_id, actor\_id, action, entity, entity\_id, ip, created\_at.

### 7.3 Redis keys

- session:{userId}:{jti} (refresh hash, TTL), rl:login:{ip}, rl:api:{tenant}:{window}, cache:ai:{tenant}:{embeddingHash}, presence:{tenant}:{userId}, BullMQ queues.

## 8. API design

### 8.1 REST (selected, all under /api/v1)

| Method and path                                               | Purpose                                  | Roles                  |
| ------------------------------------------------------------- | ---------------------------------------- | ---------------------- |
| POST /auth/register, /auth/login, /auth/refresh, /auth/logout | Auth lifecycle                           | public                 |
| GET/POST /tickets                                             | List with filters, create                | AGENT+                 |
| GET/PATCH /tickets/:id                                        | Read, update (requires version)          | AGENT+                 |
| POST /tickets/:id/messages                                    | Reply or internal note                   | AGENT+                 |
| POST /widget/session                                          | Start anonymous session                  | public with widget key |
| POST /widget/messages                                         | Send customer message                    | visitor token          |
| POST /kb/uploads/presign                                      | Get S3 presigned URL                     | OWNER, LEAD            |
| POST /kb/documents                                            | Register uploaded doc, enqueue ingestion | OWNER, LEAD            |
| GET /analytics/overview                                       | Dashboard metrics                        | LEAD+                  |
| POST /devices                                                 | Register FCM token                       | AGENT+                 |
| GET /health, /ready                                           | Liveness and readiness                   | public                 |

Standard response envelope, cursor pagination, idempotency-key header on POST that creates tickets, RFC 7807 problem-details errors.

### 8.2 GraphQL schema (gateway)

- Types: Ticket, Message, Customer, Agent, Conversation, KbDocument, AnalyticsOverview.
- Queries: tickets(filter, cursor), ticket(id), conversation(id), analyticsOverview(range), kbDocuments.
- Mutations: createTicket, updateTicket, addMessage, assignTicket, escalateConversation, uploadKbDocument.
- Subscriptions: ticketUpdated(tenantId), messageAdded(conversationId).
- Controls: query depth limit, complexity limit, DataLoader to avoid N+1, persisted queries optional, auth directive for roles.

### 8.3 Socket.IO events

- Client to server: conversation:join, message:send, typing:start, typing:stop, message:read.
- Server to client: message:new, message:ack, typing, presence:update, conversation:state, ticket:updated, notification:new.
- Rules: JWT or visitor token in handshake, room names namespaced by tenant, server-side authorization on every join, sequence numbers for replay.

### 8.4 Internal ai-service API

- POST /v1/answer (tenantId, conversationId, question, history) returns answer, citations, confidence, shouldEscalate.
- POST /v1/classify (subject, body) returns priority, category, probabilities.
- POST /v1/ingest (documentId) triggers pipeline; GET /v1/ingest/:id for status.
- POST /v1/suggest-reply, POST /v1/summarize.

## 9. AI and ML specification

### 9.1 RAG pipeline

1. **Ingestion:** extract text (pdf parser, markdown parser), normalise whitespace, remove boilerplate, split by headings first and then by tokens (about 500 tokens, 80 overlap). Store title and section path in metadata.
2. **Embedding:** sentence-transformers all-MiniLM-L6-v2 (384 dimensions), loaded lazily on first request and cached in memory. Batch size 32.
3. **Storage:** pgvector table with an HNSW index (cosine distance) and a tenant\_id filter on every query.
4. **Retrieval:** hybrid search. Vector top-20 plus Postgres full-text (tsvector) top-20, merged with reciprocal rank fusion (k=60), then top-5 after an optional cross-encoder rerank.
5. **Generation:** prompt contains tenant tone settings, the question, the last 6 messages and the 5 chunks with ids. The model must return JSON: answer, citations (chunk ids), confidence (0 to 1), shouldEscalate.
6. **Validation:** JSON parsed and validated; invalid output retried once with a repair prompt, then escalated. Every citation must exist in the retrieved set or the answer is rejected.
7. **Confidence:** combine top retrieval score, citation coverage and the model's self-rating; below the tenant threshold (default 0.55) the assistant declines and escalates.
8. **Caching:** semantic cache in Redis keyed by tenant and normalised question hash with a 24-hour TTL; cache is invalidated when a tenant's KB changes.

### 9.2 Prompting and safety

- System prompt fixed in code; tenant text is inserted only in clearly delimited data sections.
- Retrieved chunks are treated as untrusted data; instructions inside them are ignored.
- Block lists for legal, medical and payment-dispute topics force escalation.
- PII (emails, phone numbers, card-like numbers) is masked in logs and in eval data.
- Provider abstraction so Gemini, OpenAI or a local model can be swapped by config.

### 9.3 Ticket classifier (AI/ML component)

- **Task:** predict priority (LOW, MEDIUM, HIGH, URGENT) and category (billing, bug, how-to, account, feature request, other) from subject and first message.
- **Data:** a public customer-support dataset plus about 500 hand-labelled or synthetically generated tickets; stratified 70/15/15 split; document how labels were created.
- **Models compared:** TF-IDF + Logistic Regression (baseline), sentence embeddings + Logistic Regression, and an embeddings + LightGBM variant. Report accuracy, macro-F1, per-class precision and recall, and a confusion matrix.
- **Serving:** joblib artifact stored in S3, versioned by semantic version and git sha, loaded lazily by FastAPI, with a rules fallback (keywords such as outage, refund, cannot log in) if the model is unavailable.
- **Monitoring:** log predicted versus agent-corrected priority to measure drift; retraining notebook included in the repo.

### 9.4 Evaluation harness

- A golden set of 100 questions per sample tenant with expected source chunks.
- Metrics: retrieval hit rate at 5, groundedness (answer supported by cited chunks, judged by rules plus an LLM judge on a sample), escalation precision, p95 latency, tokens per answer.
- Runs on every pull request that touches ai-service; the build fails if groundedness drops by more than 3 points from the stored baseline.

## 10. Mobile agent app

### 10.1 Features

- MOB-1 (P1): Login with biometrics unlock after first sign-in; tokens in expo-secure-store (Keychain on iOS, Keystore on Android).
- MOB-2 (P1): Inbox with status and priority filters, pull to refresh, infinite scroll.
- MOB-3 (P1): Ticket and chat view with real-time messages, typing indicators, attachments through camera and gallery with S3 presigned upload.
- MOB-4 (P1): Push notifications for assignments, new customer messages and SLA warnings; tapping a notification deep-links to the ticket.
- MOB-5 (P1): Quick actions: assign to me, change status, insert AI-suggested reply or canned reply.
- MOB-6 (P2): Offline outbox that queues replies and sends on reconnect.
- MOB-7 (P2): Presence toggle (available, busy, offline) and notification settings.

### 10.2 Technical requirements

- Expo Router navigation, TanStack Query for server state, Zustand for UI state, a shared TypeScript package for API types and Zod schemas.
- Crash and error reporting through Firebase Crashlytics (development build) and structured logging.
- Accessibility: dynamic type, screen-reader labels, minimum touch target 44 by 44.
- Tested on one iOS simulator and one Android emulator in CI; on a physical Android device before each release.

### 10.3 Build and release

- **EAS Build** profiles: development, preview (internal distribution), production.
- **Fastlane** lanes: beta\_android (upload to Play internal track), beta\_ios (TestFlight, requires Apple developer account, documented as optional), screenshots.
- **OTA updates** through EAS Update for JavaScript-only changes, with runtime version pinning.
- GitHub Actions workflow builds a preview on every merge to main and attaches the artifact.

## 11. Web dashboard and widget

### 11.1 Dashboard pages

Login, Overview (metrics), Inbox (list with filters and bulk actions), Ticket detail (thread, internal notes, timeline, AI suggestion panel, customer panel), Customers, Knowledge Base (documents, ingestion status, article editor, test-the-bot console), Automation (SLA, rules, canned replies), Analytics, Team, Settings (brand, hours, AI), Integrations (API keys, webhooks), Platform Admin (for operator only).

### 11.2 Widget

- Single script tag with data-key; loads an iframe-isolated React bundle under 80 KB gzipped target.
- States: collapsed bubble, AI chat, waiting for agent, with agent, offline form, closed with CSAT prompt.
- Theming from tenant settings; keyboard accessible; works on mobile browsers.

### 11.3 UX requirements

Loading, empty and error states for every list; optimistic updates for replies; toasts for failures; light and dark themes; responsive down to 360 px; WCAG 2.1 AA colour contrast.

## 12. Security and privacy

| Area           | Requirement                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport      | HTTPS everywhere, HSTS, secure cookies where used                                                                                                              |
| Authentication | bcrypt cost 12, JWT with short expiry, rotating refresh tokens, session revocation, login throttling                                                           |
| Authorisation  | RBAC middleware plus tenant scoping in the repository layer; deny by default                                                                                   |
| Input          | Zod validation on every endpoint, request size limits, MIME and magic-byte checks for uploads, S3 presigned URLs with short expiry and content-type conditions |
| Web            | CORS allow-list per tenant domain, CSRF origin checks for cookie flows, Helmet headers, CSP for dashboard and widget                                           |
| Rate limiting  | Redis sliding window per IP, per API key and per tenant                                                                                                        |
| Secrets        | Never in git; GitHub Actions secrets, Kubernetes Secrets, AWS Secrets Manager or SSM Parameter Store                                                           |
| Data           | Encryption at rest on RDS and S3; field-level hashing for API keys; data deletion endpoint per tenant                                                          |
| AI             | Prompt-injection tests in the suite; output validation; per-tenant isolation in vector queries                                                                 |
| Dependencies   | npm audit and pip-audit in CI; Dependabot; container image scan with Trivy                                                                                     |
| Auditing       | Security-relevant actions written to audit\_log                                                                                                                |

## 13. Non-functional requirements

- **Performance targets:** REST p95 under 400 ms for list endpoints at 200 concurrent users; chat message round trip p95 under 300 ms; AI answer first token under 3 s; widget load under 2 s on 4G.
- **Scalability:** services stateless; Socket.IO uses the Redis adapter; Kubernetes HPA on CPU between 2 and 5 replicas for the gateway.
- **Reliability:** graceful shutdown, health and readiness probes, retries with exponential backoff, dead-letter queues, idempotent consumers, timeouts on every outbound call, circuit breaker around the LLM provider.
- **Maintainability:** TypeScript strict, shared types package, ADRs for major decisions, OpenAPI and GraphQL schema as sources of truth.
- **Portability:** everything runs locally with one docker-compose command.
- **Compatibility:** latest two versions of Chrome, Firefox, Safari, Edge; iOS 15+, Android 8+.

## 14. Testing strategy

### 14.1 Test pyramid

| Layer          | Tools                                                                      | Scope                                                                            | Target                    |
| -------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| Unit           | Jest, Vitest, pytest                                                       | Pure logic: state machine, SLA calculator, chunker, prompt builder, rules engine | 80%+ line coverage        |
| Property-based | fast-check                                                                 | Ticket transition map, pagination cursors, tenant scoping filters                | key invariants            |
| Integration    | Supertest, Testcontainers (MongoDB, Postgres, Redis)                       | Each service with real datastores                                                | all endpoints             |
| Contract       | Zod and GraphQL schema checks, OpenAPI diff in CI                          | Gateway versus services                                                          | no breaking changes       |
| API regression | Postman collections run with Newman in CI                                  | Auth, tickets, KB, widget                                                        | all P0 flows              |
| E2E web        | Cypress (agent flows), Playwright (widget and cross-browser)               | Login, create ticket, live chat, handoff, KB upload                              | all P0 journeys           |
| Mobile         | Jest and React Native Testing Library; manual device checklist             | Auth, inbox, push deep link                                                      | critical paths            |
| Performance    | k6                                                                         | Ticket list, chat fan-out, AI endpoint with mocked LLM                           | thresholds in section 1.6 |
| Security       | Automated cross-tenant tests, rate-limit tests, dependency and image scans | Tenant isolation, brute force, uploads                                           | zero criticals            |
| AI evaluation  | Custom harness                                                             | Retrieval and answer quality                                                     | baseline gate             |

### 14.2 Example critical test cases

- A user from tenant A cannot read, update or subscribe to tenant B's tickets, messages or documents (REST, GraphQL, socket).
- Invalid ticket transitions (for example CLOSED to NEW) are rejected; valid ones write an event.
- Two agents updating the same ticket with the same version: one succeeds, one gets 409.
- Customer asks an unanswerable question: assistant escalates, ticket is created once, transcript attached.
- Socket reconnect replays missed messages in order without duplicates.
- SLA timer does not fire for a ticket resolved before the deadline.
- Duplicate webhook delivery or duplicate ticket-create request with the same idempotency key creates one record.
- Uploading a file with a spoofed extension is rejected.

### 14.3 QA process

Written test plan and traceability matrix mapping each FR id to test ids; bug template with steps, expected, actual, severity, logs; smoke checklist before every release; exploratory test sessions each sprint.

## 15. DevOps and deployment

### 15.1 Containers

- Multi-stage Dockerfiles, non-root user, pinned base images, healthcheck instructions, .dockerignore.
- docker-compose.yml: gateway, ticket-service, ai-service, notification-service, web, mongo, postgres (pgvector), redis, mailhog, localstack (S3 locally).

### 15.2 Kubernetes

- Namespaces: supportpilot-staging, supportpilot-prod (local kind clusters for practice).
- Per service: Deployment (readiness and liveness probes, resource requests and limits), Service, ConfigMap, Secret; Ingress with TLS for gateway and web; HorizontalPodAutoscaler for gateway and ai-service; PodDisruptionBudget; NetworkPolicy so only the gateway reaches internal services.
- Packaged with Kustomize overlays (staging and prod); optional Helm chart as a stretch.
- Jobs and CronJobs: database migrations and nightly eval run.

### 15.3 CI/CD with GitHub Actions

| Workflow           | Trigger                       | Steps                                                                                                                               |
| ------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ci.yml             | pull request                  | install with cache, lint, type-check, unit tests with coverage, integration tests with service containers, build images, Trivy scan |
| e2e.yml            | pull request (label) and main | start compose stack, run Cypress and Playwright, upload videos and traces                                                           |
| perf.yml           | nightly                       | run k6 and publish summary                                                                                                          |
| ai-eval.yml        | PR touching ai-service        | run eval harness, compare with baseline, comment results                                                                            |
| deploy-staging.yml | merge to main                 | build and push images to GHCR or ECR, apply Kustomize to staging, run smoke tests                                                   |
| deploy-prod.yml    | manual approval               | promote tagged images, run migrations, verify health, roll back on failure                                                          |
| mobile.yml         | merge to main                 | EAS preview build, Fastlane lane on tag                                                                                             |

Branch protection on main: required checks, one self-review checklist, conventional commits, squash merge.

### 15.4 AWS deployment (demo environment)

- S3 bucket for KB files and attachments with private ACLs and lifecycle rules.
- RDS PostgreSQL with pgvector in a private subnet; MongoDB Atlas free or M10 tier; Redis through ElastiCache or a container on EC2 for the demo.
- Services on ECS Fargate or a single EC2 with Docker (document the chosen path and cost); Application Load Balancer or Caddy for TLS.
- Lambda function for signed webhook delivery, triggered by an SQS queue.
- IAM least-privilege roles, CloudWatch logs and alarms, budget alert at a low monthly limit.
- Infrastructure as code with Terraform as a stretch goal; otherwise a documented step-by-step runbook.

## 16. Observability

- Structured JSON logs (pino, structlog) with request id, tenant id and user id, propagated across services.
- Metrics: request rate, errors, latency histograms, queue depth, job failures, LLM tokens and cost, cache hit rate, socket connections. Prometheus endpoints and a Grafana dashboard JSON committed to the repo.
- Tracing with OpenTelemetry across gateway, ticket-service and ai-service.
- Alerts (CloudWatch or Grafana): error rate, p95 latency, queue backlog, failed jobs, SLA breach spike.
- Sentry or equivalent for frontend and mobile errors.

## 17. Delivery plan (Agile)

### 17.1 Process

Solo Scrum with two-week sprints. Backlog and board in GitHub Projects with columns Backlog, Ready, In progress, In review, Done. Each sprint has a written goal, planning, a demo recorded as a short video, and a retrospective note committed to docs/retros. User stories use the format: As a \[persona\], I want \[capability\], so that \[benefit\], with acceptance criteria. Issues use labels for module, priority and type. Pull request template includes a checklist for tests, docs and security.

### 17.2 Sprints

| Sprint | Weeks  | Goal                 | Exit criteria                                                                                                                                                                   |
| ------ | ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | 0      | Foundations          | Repo, monorepo tooling, CI skeleton, compose stack, ADRs, this PRD committed                                                                                                    |
| 1      | 1 to 2 | MERN core            | Auth with refresh rotation, tenancy, tickets and state machine, MongoDB indexes, React dashboard inbox and ticket view, Jest tests, deployed demo                               |
| 2      | 3 to 4 | Realtime and AI      | Socket.IO chat with Redis adapter, widget, KB ingestion, RAG answer with citations and handoff, GraphQL gateway, eval harness baseline                                          |
| 3      | 5 to 6 | Platform and quality | Notification service with BullMQ, SLA automation, classifier, Docker images, Kubernetes manifests, full GitHub Actions pipelines, Cypress, Playwright and k6 suites, AWS deploy |
| 4      | 7 to 8 | Mobile and polish    | Expo agent app, FCM push, EAS Build and Fastlane, analytics dashboards, webhooks Lambda, security review, README, architecture diagrams, demo video                             |

### 17.3 Definition of done (per story)

Code reviewed against checklist, unit and integration tests added, no critical lint or type errors, docs updated, feature works in compose and staging, observability added, and the matching test ids recorded in the traceability matrix.

## 18. Repository structure

A single monorepo managed with pnpm workspaces and Turborepo:

- apps/web, apps/widget, apps/mobile, apps/gateway, apps/ticket-service, apps/notification-service, apps/ai-service (Python), apps/webhook-lambda.
- packages/shared-types, packages/validators (Zod), packages/api-client, packages/eslint-config.
- infra/docker, infra/k8s (base and overlays), infra/aws (runbook or Terraform), infra/grafana.
- tests/e2e (Cypress, Playwright), tests/perf (k6), tests/api (Postman collections), tests/ai-eval.
- docs/ (PRD, ADRs, architecture diagrams, runbooks, test plan, retros, API docs).
- .github/workflows, .github/ISSUE\_TEMPLATE, PULL\_REQUEST\_TEMPLATE.md.

## 19. Mapping to resumes and evidence to collect

Use only measured results. For each row, collect the evidence, then write the bullet with the real number.

| Skill or keyword                       | Where it is used           | Evidence to capture                      | Bullet template (fill with real data)                                                        |
| -------------------------------------- | -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| MongoDB, Mongoose, aggregation         | tickets, analytics         | Index list, explain() before and after   | Designed N collections and M compound indexes, cutting ticket-list query time from X to Y ms |
| GraphQL                                | gateway                    | Schema size, DataLoader effect           | Built an Apollo GraphQL gateway with N types and DataLoader, removing N+1 queries            |
| Microservices                          | 4 services                 | Architecture diagram, service count      | Split the platform into N services communicating over REST and Redis queues                  |
| WebSockets                             | live chat                  | k6 or custom socket load result          | Delivered chat messages at p95 X ms with N concurrent connections                            |
| Redis and BullMQ                       | cache, queues, rate limits | Cache hit rate, queue metrics            | Added semantic cache achieving X% hit rate and cutting LLM calls by Y%                       |
| RAG and GenAI                          | ai-service                 | Eval report                              | Built hybrid RAG with citations reaching X% groundedness on a 100-question eval set          |
| AI/ML                                  | classifier                 | Metrics report                           | Trained a priority classifier with macro-F1 X versus baseline Y                              |
| Docker, Kubernetes                     | infra                      | Manifests, HPA test                      | Deployed N services to Kubernetes with probes and autoscaling between 2 and 5 replicas       |
| GitHub Actions CI/CD                   | workflows                  | Pipeline duration, pass rate             | Automated lint, test, scan and deploy gates in X minutes                                     |
| AWS (S3, RDS, EC2 or ECS, Lambda)      | deploy                     | Console screenshots, runbook             | Deployed on AWS using S3, RDS, ECS and Lambda for signed webhooks                            |
| Jest, Cypress, Playwright, k6, Postman | tests                      | Coverage report, k6 summary              | Wrote N tests across unit, API and E2E layers at X% coverage                                 |
| Expo, EAS Build, Fastlane, FCM         | mobile                     | Build logs, store or internal track link | Shipped an Expo app with EAS Build, a Fastlane lane and FCM push                             |
| Security best practices                | all                        | Test results, scan output                | Enforced RBAC, tenant isolation and rate limiting verified by N automated tests              |
| Agile and cross-functional             | process                    | Board, retros                            | Ran 2-week sprints with written goals, demos and retros                                      |

Honesty rule for resumes: describe this as a personal project with a live demo link and repository. Do not present it as client or employer work.

## 20. Risks and mitigations

| Risk                           | Impact               | Mitigation                                                                 |
| ------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| Scope too large for solo build | Unfinished project   | Strict P0 then P1 order; each sprint ships a working slice; cut P2 first   |
| LLM cost or quota limits       | Blocks AI features   | Free tiers, caching, small eval sets, provider abstraction, mock LLM in CI |
| Cloud cost surprises           | Unexpected bills     | Budget alerts, tear-down scripts, local kind cluster as primary            |
| Cross-tenant leakage           | Severe security flaw | Tenant scoping in repository layer plus automated isolation tests          |
| Retrieval quality poor         | Wrong answers        | Hybrid search, rerank, thresholds, eval gate, escalation fallback          |
| Mobile store accounts needed   | Delays iOS release   | Use internal and preview distribution; TestFlight optional                 |
| Flaky E2E tests                | Slow CI              | Stable test data, retries with traces, isolated environments               |
| Over-engineering               | Wasted time          | Keep each skill's usage real but minimal; write ADRs and move on           |

## 21. Cost estimate

Target of near zero: MongoDB Atlas free tier, Supabase or local Postgres, Upstash or local Redis, Gemini free tier, Vercel and Render free tiers, GitHub Actions free minutes, kind for Kubernetes, EAS free plan. The AWS demo is short-lived and kept under a small monthly budget with alerts.

## 22. Acceptance checklist (project complete)

- All P0 and P1 requirements implemented and traced to tests.
- Live demo link for dashboard and widget, repository with a clear README, architecture diagram and demo video.
- CI green on main; coverage and k6 reports stored as artifacts.
- Kubernetes manifests apply cleanly on a fresh kind cluster with one script.
- Eval report and classifier metrics committed.
- Mobile preview build installable on an Android device; iOS build documented.
- Security checklist complete with scan results.
- Resume bullets updated using measured numbers only.

## 23. Open questions

- Preferred LLM provider and budget for the demo (Gemini free tier assumed).
- ECS Fargate or a single EC2 for the AWS demo.
- Whether to include Terraform in v1 or keep it as a stretch goal.
- Public dataset choice for the classifier.

## Appendix A: Environment variables (names only)

MONGODB\_URI, DATABASE\_URL, REDIS\_URL, JWT\_ACCESS\_SECRET, JWT\_REFRESH\_SECRET, SERVICE\_TOKEN, S3\_BUCKET, AWS\_REGION, GEMINI\_API\_KEY, OPENAI\_API\_KEY, FCM\_SERVICE\_ACCOUNT, RESEND\_API\_KEY, WEBHOOK\_SIGNING\_SECRET, ALLOWED\_ORIGINS, SENTRY\_DSN.

## Appendix B: Glossary

**Tenant:** a business using the platform. **RAG:** retrieval-augmented generation. **SLA:** service level agreement for response and resolution times. **HNSW:** approximate nearest-neighbour index used by pgvector. **RRF:** reciprocal rank fusion. **EAS:** Expo Application Services. **HPA:** Kubernetes Horizontal Pod Autoscaler. **DLQ:** dead-letter queue.
