# Agent Sync & Communication Log

Shared message board and status ledger for all AI agents working on SupportPilot.
Update this file when starting work, switching tasks, or noting blockers.

---

## Current Monorepo State

- **Status**: All 5 Sprints (S0 through S4) Complete & Verified (v1.0.0).
- **Automated Tests**: 388+ tests passing across 12 packages (TypeScript + Python).
- **Coverage**: Statement coverage > 85% across core packages.
- **Active Task**: None pending in roadmap. Ready for local execution, browser testing, and staging deployment.

---

## Microservices Architecture Matrix

| Service                  | App Directory               | Port   | Tech Stack                                    | Role                                                                   |
| :----------------------- | :-------------------------- | :----- | :-------------------------------------------- | :--------------------------------------------------------------------- |
| **Web Dashboard**        | `apps/web`                  | `3000` | React 19, Vite, Tailwind v4, TanStack Query   | Agent & Owner dashboard (Tickets, Live Chat, KB RAG, Analytics, Admin) |
| **Chat Widget**          | `apps/widget`               | `5174` | React 19, Vite, Socket.IO client              | Embeddable customer live-chat widget                                   |
| **API Gateway**          | `apps/gateway`              | `4000` | Node 22, Express 5, Apollo GraphQL, Socket.IO | Reverse proxy, rate limiting, GraphQL SDL, Socket.IO server            |
| **Ticket Service**       | `apps/ticket-service`       | `4001` | Node 22, Express 5, MongoDB / Mongoose        | Multi-tenant core ticket engine, RBAC, SLA calculator, rules           |
| **AI Service**           | `apps/ai-service`           | `8000` | Python 3.12, FastAPI, pgvector, scikit-learn  | Ticket classification, hybrid RAG retrieval, confidence scoring        |
| **Notification Service** | `apps/notification-service` | `4003` | Node 22, BullMQ, Redis, Nodemailer            | Background queues (email, SLA delayed timers, DLQ, audit)              |
| **Mobile App**           | `apps/mobile`               | `8081` | React Native, Expo Router v3, Zustand         | Mobile agent app (Biometrics, Live Chat, Push, Offline Outbox)         |
| **Webhook Lambda**       | `apps/webhook-lambda`       | `3001` | Node 22, AWS SDK v3, SAM local                | HMAC-SHA256 signed webhook dispatch from SQS                           |

---

## Agent Communication Protocol

When coordinating across multiple agents (subagents or Swarm workers):

1. **Coordination Channel**: Swarm message board via `post_message` and `read_board`, or sync via this ledger `docs/agent-sync.md`.
2. **Ground Rules**: Read `AGENTS.md` and `docs/11-progress-log.md` before touching code.
3. **No Paid APIs**: Use Docker Compose mock services (MinIO, Redis, Postgres+pgvector, Mongo, MailHog) and `LLM_PROVIDER=mock`.
4. **Tenant Isolation**: Every database query and cache operation must scope by `tenantId`.

---

## Message Board (Agent Chat Area)

| Timestamp (ISO)        | Agent Name        | Status / Action | Message / Handoff Notes                                                                                                                                                                                                                                                                             |
| :--------------------- | :---------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-11-20T21:04:00Z` | `Coordinator`     | `IDLE`          | Monorepo v1.0.0 completely built. All sprints (S0-S4) verified. Waiting for user instruction to launch dev stack.                                                                                                                                                                                   |
| `2026-11-20T22:38:10Z` | `Coordinator`     | `PLANNING`      | Convening agent sync to resolve all remaining PRD items from `remaining-items.md`. Target: 100% PRD spec completeness.                                                                                                                                                                              |
| `2026-11-20T22:38:15Z` | `Agent-Backend`   | `ONLINE`        | Ready. Audited ticket-service, gateway, notification-service. Identified gaps: tenant quota middleware (TEN-4), auto-assignment round-robin (TKT-4), bulk ticket actions (TKT-8), auto-close job (AUTO-4), canned replies (AUTO-5), team/customer routes, OpenAPI spec.                             |
| `2026-11-20T22:38:22Z` | `Agent-Frontend`  | `ONLINE`        | Ready. Audited web dashboard. Identified gaps: Customers view, Team view, Automation management view (Rules + Canned Replies), notification tray/bell (NOTIF-1), inbox bulk selection toolbar, dark mode toggle.                                                                                    |
| `2026-11-20T22:38:30Z` | `Agent-AI-ML`     | `ONLINE`        | Ready. Audited ai-service. Identified gaps: per-tenant AI call/token quota tracker with degradation to pure retrieval (AI-8), article feedback endpoint (KB-6).                                                                                                                                     |
| `2026-11-20T22:38:38Z` | `Agent-DevOps-QA` | `ONLINE`        | Ready. Identified gaps: `.github/workflows/deploy-prod.yml`, swagger/OpenAPI endpoint on gateway, test suite expansion for new routes, evidence metrics M08/M09/M10 test scaffolding.                                                                                                               |
| `2026-11-20T23:08:35Z` | `frontend-agent`  | `COMPLETED`     | Frontend P1 & views complete: CustomersView, TeamView, AutomationView, NotificationBell (NOTIF-1), Inbox bulk toolbar (TKT-8), Dark mode toggle. 50 tests passing.                                                                                                                                  |
| `2026-11-20T23:25:21Z` | `ai-infra-agent`  | `COMPLETED`     | AI & DevOps P1 complete: QuotaTracker & graceful degradation to retrieval fallback (AI-8), pytest quota suite (73 total passing), deploy-prod.yml workflow.                                                                                                                                         |
| `2026-11-20T23:31:52Z` | `backend-agent`   | `COMPLETED`     | Backend P1 complete: Quota middleware (TEN-4), AssignmentService round-robin/least-loaded (TKT-4), Bulk tickets API (TKT-8), Ticket customFields/link (TKT-6), Notification prefs (NOTIF-4), Customers & Team APIs, OpenAPI 3.0 / Swagger docs. 180 tests passing in ticket-service, 50 in gateway. |
| `2026-11-20T23:33:00Z` | `Coordinator`     | `VERIFYING`     | All 3 parallel streams finished successfully. Running cross-monorepo test verification.                                                                                                                                                                                                             |

---

## Agent Dialogue & Parallel Workstream Sync

### [Round 1: Scope Triage & YAGNI Filter]

- **`Coordinator`**: Team, user wants all remaining doc requirements implemented. We follow Ponytail principle (YAGNI, minimal clean code, standard libs, no bloat) and tenant isolation rules. What are our parallel boundaries to prevent merge collisions?
- **`Agent-Backend`**: I own `apps/ticket-service`, `apps/gateway`, `packages/shared-lib`, and `packages/shared-types`. I can implement:
  1. `TEN-4`: Redis-backed tenant quota checker middleware (`quota:tenant:{id}:ai_daily`, `quota:tenant:{id}:msg_daily`).
  2. `TKT-4`: Round-robin / least-loaded assignment service (`AssignmentService.getNextAgent(tenantId)`).
  3. `TKT-8`: `POST /api/v1/tickets/bulk` (actions: `assign`, `tag`, `close`) with atomic bulk writes.
  4. `AUTO-5` & `AUTO-4`: `CannedReply` model & routes (`GET/POST/PATCH/DELETE /api/v1/canned-replies`), auto-close scheduler hook.
  5. Customers & Team endpoints: `GET/POST /api/v1/customers` and `GET/POST /api/v1/team`.
  6. OpenAPI / Swagger router mounting via `swagger-ui-express` or static json spec.
- **`Agent-Frontend`**: I own `apps/web` and `apps/widget`. I won't touch backend files. My deliverables:
  1. Customers management page (`apps/web/src/components/customers/CustomersView.tsx`).
  2. Team management page (`apps/web/src/components/team/TeamView.tsx`) with invite modal and role chips.
  3. Automation management page (`apps/web/src/components/automation/AutomationView.tsx`) for rules, SLA, and canned reply snippets.
  4. Header notification bell + dropdown tray (`NotificationBell.tsx`) wired to Socket.IO events (`notification:new`, `handoff:escalated`).
  5. Ticket inbox multi-select checkbox bar with bulk assign, bulk tag, bulk status buttons.
  6. Dark theme toggle class switch on root html element.
- **`Agent-AI-ML`**: I own `apps/ai-service`. Fully isolated in Python. My deliverables:
  1. `AI-8`: Add tenant quota check inside `RagService.generate_answer`. When token or call budget exceeded for the tenant day, degrade gracefully to retrieval-only response (extract direct excerpt with citations, skip LLM generative call).
  2. `KB-6`: Add `POST /v1/kb/feedback` endpoint logging thumbs-up/down ratings to `kb_feedback` table.
- **`Agent-DevOps-QA`**: I own `.github/workflows/`, `tests/`, and `infra/`. Deliverables:
  1. Author `.github/workflows/deploy-prod.yml` with manual dispatch/tag trigger, staging image promotion, and rollback probe.
  2. Update Newman Postman collections and integration tests for bulk actions, canned replies, and quotas.
  3. Verify test runs locally (`pnpm verify`) once workers complete.

---

### [Round 2: Interface Contracts & Architecture Agreement]

- **`Coordinator`**: Let's lock the API contracts so `Agent-Frontend` and `Agent-Backend` work seamlessly:
  - Bulk action payload: `POST /api/v1/tickets/bulk` -> `{ ticketIds: string[], action: 'ASSIGN' | 'TAG' | 'STATUS', value: string }`
  - Canned replies payload: `POST /api/v1/canned-replies` -> `{ title: string, shortcut: string, content: string, category?: string }`
  - Team invite payload: `POST /api/v1/team/invite` -> `{ email: string, name: string, role: Role }`
  - Quota response header: `X-Quota-Remaining-AI`, `X-Quota-Remaining-Messages`
- **`Agent-Backend`**: Agreed. Contracts match existing RFC 7807 problem details and Zod validator schemas. I will put shared schemas into `packages/validators/src/`.
- **`Agent-Frontend`**: Contracts accepted. I will use existing `api.ts` pattern with TanStack Query hooks.
- **`Agent-AI-ML`**: Confirmed. AI service quota degradation will return JSON `{ answer: "...", citations: [...], provider: "retrieval_fallback", confidence: 0.7, quota_exceeded: true }`.
- **`Agent-DevOps-QA`**: CI/CD contract accepted. Zero new external dependencies.

---

## Parallel Execution Plan (Ready for User "Proceed")

| Stream                      | Owner             | Target Package / Files                                       | Deliverables                                                                                      | Status                 |
| :-------------------------- | :---------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :--------------------- |
| **Stream A (Core Backend)** | `Agent-Backend`   | `apps/ticket-service`, `apps/gateway`, `packages/validators` | Quota middleware, bulk tickets API, canned replies, round-robin, customer/team APIs, swagger spec | `PENDING_CONFIRMATION` |
| **Stream B (UI Dashboard)** | `Agent-Frontend`  | `apps/web`, `apps/widget`                                    | CustomersView, TeamView, AutomationView, Notification tray, Inbox bulk bar, dark mode toggle      | `PENDING_CONFIRMATION` |
| **Stream C (AI Service)**   | `Agent-AI-ML`     | `apps/ai-service`                                            | Quota tracker + graceful degradation (AI-8), article feedback API (KB-6)                          | `PENDING_CONFIRMATION` |
| **Stream D (DevOps & E2E)** | `Agent-DevOps-QA` | `.github/workflows`, `tests/`                                | `deploy-prod.yml`, regression tests, Postman collection update, `pnpm verify`                     | `PENDING_CONFIRMATION` |

---
