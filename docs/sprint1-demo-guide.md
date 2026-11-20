# Sprint 1 Demo and Verification Guide

## Overview

Sprint 1 implements the complete multi-tenant MERN core for SupportPilot:

- Tenant isolation enforced at the repository layer (`BaseTenantRepository`)
- User registration and JWT authentication with Redis token rotation & reuse detection
- Deny-by-default RBAC middleware with 5 roles (`PLATFORM_ADMIN`, `OWNER`, `LEAD`, `AGENT`, `VIEWER`)
- Per-tenant atomic ticket counters and optimistic concurrency version control (409 conflict detection)
- State machine for ticket status transitions with property-based tests (`fast-check`)
- Public message thread and internal notes with sequence numbering and event timeline logging
- Compound and weighted text search indexes with query performance benchmarked using `explain('executionStats')`
- API Gateway with Redis sliding window rate limiter and reverse proxy
- Web dashboard (React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand) with login, inbox filters, and ticket detail views
- Postman collection automated via Newman in CI

---

## Architecture Topology

```
+-------------------------------------------------------------+
| Browser / Dashboard (React 19, Vite, TanStack Query:3000)   |
+-------------------------------------------------------------+
                               |
                   HTTP /api/v1 (JWT Auth)
                               v
+-------------------------------------------------------------+
| API Gateway (Express 5, Port 4000)                          |
| - Redis Sliding-Window Rate Limiter (AUTH-5: 5/15m login)   |
| - JWT Auth Verification & Passthrough                       |
| - Reverse Proxy (forwarding with x-service-token)           |
+-------------------------------------------------------------+
                               |
                      Reverse Proxy
                               v
+-------------------------------------------------------------+
| Ticket Service (Express 5, Port 4001)                       |
| - BaseTenantRepository (strict tenantId scoping)            |
| - RBAC Middleware (ROLE_HIERARCHY)                          |
| - Ticket & Counter Models (Atomic number generation)        |
| - Status Transition State Machine                           |
| - Message & Event Timeline Repositories                     |
| - MongoDB Mongoose 9 + Redis                                |
+-------------------------------------------------------------+
```

---

## Automated Verification

Run the Sprint 1 demo script:

```powershell
# Windows
.\scripts\demo-sprint1.ps1
```

```bash
# Linux / macOS
./scripts/demo-sprint1.sh
```

### Direct Verification Commands

1. **Monorepo Lint, Typecheck, and Unit Tests:**

   ```bash
   pnpm verify
   ```

   _Expected:_ 36/36 turbo tasks succeed, 0 errors, 152 tests passing.

2. **Test Coverage Suite (CI Artifact):**

   ```bash
   pnpm test:ci
   ```

   _Expected:_ 88.06% statement coverage on `ticket-service` (target >= 70%).

3. **Postman / Newman End-to-End Suite:**
   ```bash
   pnpm test:postman
   ```
   _Expected:_ 11 requests, 21 assertions executed, 0 failed.

---

## Manual Walkthrough via HTTP API

### 1. Health Probe

```bash
curl -X GET http://localhost:4000/health
# Response: {"status":"healthy"}
```

### 2. Register Tenant & Owner User

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Global",
    "name": "Jane Owner",
    "email": "owner@acme.com",
    "password": "Password123!"
  }'
# Response 201: { "data": { "tenant": {...}, "user": {...}, "accessToken": "...", "refreshToken": "..." } }
```

### 3. Create Ticket (Version = 1, Status = NEW)

```bash
curl -X POST http://localhost:4000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{
    "subject": "Email delivery failure",
    "description": "Outbound SMTP emails bouncing with SPF error",
    "priority": "HIGH",
    "tags": ["email", "spf"]
  }'
# Response 201: { "data": { "id": "...", "number": 1001, "status": "NEW", "version": 1 } }
```

### 4. Post Internal Note & Public Reply

```bash
# Internal Note (hidden from customer):
curl -X POST http://localhost:4000/api/v1/tickets/<TICKET_ID>/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"body": "DNS records were updated 10m ago. Waiting for TTL.", "isInternal": true}'

# Public Reply:
curl -X POST http://localhost:4000/api/v1/tickets/<TICKET_ID>/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"body": "Hello, we have updated the SPF TXT records.", "isInternal": false}'
```

### 5. Transition Ticket Status (NEW -> OPEN)

```bash
curl -X PATCH http://localhost:4000/api/v1/tickets/<TICKET_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"version": 1, "status": "OPEN"}'
# Response 200: { "data": { "status": "OPEN", "version": 2 } }
```

### 6. Optimistic Concurrency Conflict Detection (409)

```bash
# Retrying with stale version 1 triggers 409 Conflict:
curl -X PATCH http://localhost:4000/api/v1/tickets/<TICKET_ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"version": 1, "status": "RESOLVED"}'
# Response 409: {"type":"about:blank","title":"Conflict","status":409,"detail":"Version conflict: ticket was modified concurrently"}
```

---

## Sprint 1 Exit Gate Checklist

| Requirement           | Target                                   | Achieved                                                 | Status |
| --------------------- | ---------------------------------------- | -------------------------------------------------------- | ------ |
| Tenant Isolation      | Zero cross-tenant data leakage           | Injected at repository layer with filter injection guard | PASS   |
| P0 Ticketing          | End-to-end CRUD + Notes + Events         | Implemented & verified                                   | PASS   |
| Test Coverage         | >= 70% on ticket-service                 | 88.06% statements / 88.06% lines                         | PASS   |
| Monorepo Verification | All packages pass lint, typecheck, tests | 36/36 turbo tasks green                                  | PASS   |
| API Integration       | Automated Postman suite in CI            | 11 requests, 21 assertions, 0 failed                     | PASS   |
| Web UI                | Login, Inbox filters, Ticket detail      | React 19 app with 14 passing component tests             | PASS   |
