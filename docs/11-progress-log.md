# Progress Log (update after every session)

## Current state

- Date: 2026-11-20
- Current sprint: Sprint 2 (Realtime and AI)
- Last completed task id: S1-T14
- Next task id: S2-T01
- Blockers: Docker not installed (docker-compose ready but can't run yet)
- Environment notes: Node 24.18, pnpm 10.11, Python 3.13, TypeScript 5.9, git 2.52

## Decisions made since the PRD

- ADR-001: Used ESLint flat config (v9) with separate type-aware linting for src vs tests/config files
- ADR-002: Express 5 (latest) for all Node services
- ADR-003: Vitest over Jest for Node packages (faster, native ESM support)
- ADR-004: Separated ticket-service Express app creation from listener for isolated testing
- ADR-005: Used bcryptjs for pure-JS cross-platform bcrypt hashing with cost 12

## Session log

### 2026-11-20

- Done:
  - Sprint 0 complete (S0-T01 through S0-T07)
  - S1-T01: ticket-service skeleton, Mongoose connection module with event listeners and retry handling, `/health` and `/ready` endpoints, graceful shutdown on SIGTERM/SIGINT.
  - S1-T02: Tenant and User Mongoose models with compound indexes, default settings (brand, business hours, SLA, AI threshold), slug generator, and `POST /api/v1/auth/register` flow with bcrypt cost 12 password hashing.
  - S1-T03: JWT auth — login with bcrypt verify, access token (15m) + refresh token (7d) rotation via Redis hash store, reuse detection revokes all sessions, logout endpoint, `requireAuth` middleware. Added `jsonwebtoken` and `ioredis` deps. 10 tests: validation, wrong email/password, login success, token rotation, reuse detection, expired token, logout 204, auth middleware reject/accept.
  - S1-T04: RBAC middleware (`requireRoles`, `requireMinRole`, `hasMinRole`, `hasRole`, `ROLE_HIERARCHY`) with deny-by-default (unauthenticated 401, unauthorized 403, empty allowed roles 403). Added `AuthUser` to shared types. 48 new tests (13 unit tests in shared-lib + 35 role matrix tests in ticket-service covering public, AGENT+, LEAD+, OWNER, and locked routes).
  - S1-T05: Tenant-scoped repository base class `BaseTenantRepository<T>` enforcing strict tenant isolation. Injects tenantId into all queries, mutations, insertions; forbids unscoped operations and cross-tenant query injection; implements `findById`, `findOne`, `find`, `findWithPagination`, `create`, `updateById`, `updateOne`, `deleteById`, `deleteOne`, `count`, `exists`. Added `UserRepository`. 19 tests verifying cross-tenant read/update/delete isolation and filter injection rejection.
  - S1-T06: Ticket and Counter Mongoose models with per-tenant auto-incrementing numbers, optimistic concurrency version control (TKT-9), `TicketRepository`, Zod validation schemas (`createTicketSchema`, `updateTicketSchema`, `ticketFilterSchema`), and routes (`GET /api/v1/tickets`, `POST /api/v1/tickets`, `GET /api/v1/tickets/:id`, `PATCH /api/v1/tickets/:id`). 10 new integration tests verifying atomic number generation, filtering/pagination, detail retrieval, version incrementing, 409 conflict detection on stale version, and cross-tenant isolation.
  - S1-T07: Ticket status transition state machine `ALLOWED_STATUS_TRANSITIONS`, `canTransitionStatus`, `validateStatusTransition` enforcing PRD transition rules (NEW -> OPEN|CLOSED, OPEN -> PENDING_CUSTOMER|ON_HOLD|RESOLVED, PENDING_CUSTOMER -> OPEN|RESOLVED|CLOSED, ON_HOLD -> OPEN|RESOLVED, RESOLVED -> OPEN|CLOSED, CLOSED terminal). Integrated transition check in `TicketRepository.updateTicketWithVersion`. Added `fast-check` property-based tests verifying self-transitions, non-reversibility to NEW, CLOSED terminality, invariant table matching, and random path validity (9 tests).
  - S1-T08: Messages and internal notes (`Message` model, `MessageRepository`, `POST /api/v1/tickets/:id/messages`), and ticket activity timeline events (`TicketEvent` model, `TicketEventRepository`, chronological event recording on STATUS/PRIORITY/ASSIGN/TAG changes and MESSAGE/NOTE additions). Updated `GET /api/v1/tickets/:id` to return ticket with timeline and message thread. 8 new integration tests covering message threading, internal note isolation, status/priority/assign/tag event recording, and cross-tenant isolation.
  - S1-T09: Search and filtering compound and text indexes on `ticketSchema` ((tenantId, number) unique, (tenantId, status, priority, updatedAt), (tenantId, assigneeId, status), (tenantId, tags, status), (tenantId, createdAt), weighted compound text index on (tenantId, subject, description)). Implemented `explainListTickets` using `.explain('executionStats')` for query performance audit, recorded M03 benchmark in `docs/10-resume-evidence-tracker.md`. 9 new tests verifying index configurations, query construction, and execution plan output.
  - S1-T10: Gateway skeleton with Redis connection manager, Redis sliding window rate limiting middleware (`createRateLimiter` with login 5/15m limit per AUTH-5 and general 100/1m API limit, headers `X-RateLimit-*`, 429 Retry-After RFC 7807 problem details), in-memory JWT auth passthrough (`createAuthPassthrough`), and reverse proxy middleware (`createProxyMiddleware`) forwarding requests with `x-service-token`, `x-request-id`, and `Authorization` to ticket-service with 502 error handling. 8 new integration tests covering health, rate limiting, and proxy behavior.
  - S1-T11: Web dashboard React application (`apps/web`): React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand, Lucide icons. Implemented authentication store (`useAuthStore`) with localStorage persistence, API client (`apps/web/src/lib/api.ts`) against gateway proxy, Shell layout with user/role badge and navigation, LoginForm and RegisterForm with error summary, TicketInbox view with debounced search, status and priority filter selectors and empty state, TicketDetail view with ticket header, 409 conflict detection, message thread distinguishing internal notes from public replies, activity timeline, and message composer supporting public replies and internal notes with sequence ordering. Added CreateTicketModal. 14 new tests covering auth store, login form, ticket inbox, and ticket detail (152 total tests monorepo).
  - S1-T12: Monorepo test coverage configuration and CI integration: configured `@vitest/coverage-v8` on root, ticket-service and web packages. Fixed `test:ci` script to pass `--coverage` across turbo pipeline. Ticket-service achieved 88.06% statement coverage (exceeding Sprint 1 >= 70% threshold). Recorded M02 measurement in evidence tracker.
  - S1-T13: Postman collection (`tests/api/supportpilot-sprint1.collection.json`) and environment (`tests/api/supportpilot.environment.json`) covering complete Sprint 1 lifecycle: health check, tenant registration, login, ticket creation, list filtering, detail view, internal notes, public replies, status transition to OPEN, 409 conflict detection, and logout. Added hermetic Vitest Newman runner (`tests/api/newman.test.ts`), `pnpm test:postman` root script, and CI step in `.github/workflows/ci.yml`. 11 requests, 21 assertions passing with 0 failures.
  - S1-T14: Sprint 1 local demo script (`scripts/demo-sprint1.ps1`, `scripts/demo-sprint1.sh`) and comprehensive verification guide (`docs/sprint1-demo-guide.md`). Completed Sprint 1 Exit Gate: P0 ticketing verified end-to-end, ticket-service statement coverage at 88.06% (exceeding 70% requirement), 36/36 turbo tasks green, all 14 Sprint 1 tasks complete.
- Tests added / results: 153 tests passing across monorepo (20 in shared-lib, 106 in ticket-service, 8 in gateway, 4 in validators, 14 in web, 1 newman runner with 21 collection assertions)
- Measurements recorded (M-ids): M02 (test count & coverage: 153 tests, 88.06% ticket-service statement coverage), M03 (Mongo explain executionStats for ticket list compound indexes)
- Issues found: none
- Next: S2-T01 (Socket.IO on gateway with JWT/visitor handshake, rooms, Redis adapter)
  - S0-T04: .env.example + Zod env loader in @supportpilot/validators with 4 passing tests
  - S0-T05: CI skeleton .github/workflows/ci.yml with service containers
  - S0-T06: Logger (pino), request-id middleware, error handler (RFC 7807) in @supportpilot/shared-lib with 7 passing tests
  - S0-T07: GitHub issue templates (bug, feature) + PR template
- Tests added / results: 11 tests passing (4 env loader, 2 logger, 2 request-id, 3 error-handler)
- Measurements recorded (M-ids): none yet
- Issues found: Docker not installed on dev machine (compose file ready)
- Next: S1-T01 (ticket-service skeleton, Mongoose connection, health endpoints)

## Handoff checklist for the next person or AI

- [x] `pnpm verify` passes on main (36/36 tasks green, 138 tests)
- [ ] `docker compose up -d` brings up datastores healthy (Docker not installed yet)
- [x] README setup steps still accurate
- [x] Roadmap checkboxes up to date
- [ ] No uncommitted work; branch name and open PR noted above
