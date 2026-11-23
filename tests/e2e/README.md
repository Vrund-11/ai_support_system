# SupportPilot End-to-End (E2E) Test Suites

This directory contains the automated end-to-end test suites for the SupportPilot platform:

1. **Hermetic Vitest E2E Suite** (`tests/e2e/e2e-runner.test.ts`):
   Executes in-memory integration and system tests across ticket lifecycle, SLA calculations, out-of-band notifications, and cross-tenant boundaries against real containerized datastores (PostgreSQL/pgvector, MongoDB, Redis).

2. **Playwright Mocked Project** (`tests/e2e/playwright/mocked/`):
   Tests browser UI flows (tickets, authentication, widget chat, tenant isolation, and realtime websocket sync) against mocked API endpoints and frontend dev servers.

3. **Cypress Headless E2E Suite** (`tests/e2e/cypress/e2e/`):
   Validates RBAC multi-role authorization matrices, optimistic locking concurrency conflicts, and agent handoffs under headless Chrome with `xvfb-run`. Runs unmasked without `continue-on-error`.

4. **Playwright Live Project** (`tests/e2e/playwright/live/`):
   Tests full end-to-end integration against the live multi-container docker compose microservices stack (ports 3000 web, 4000 gateway, 4001 ticket-service, 5001 notification-service, 8000 ai-service, and infra datastores).

---

## Live Compose Suite Execution & CI Runner Limitations

### Why Live Compose E2E is Maintained as a Documented Local-Only Suite
The full live compose stack requires:
- **3 Infrastructure Services** (`infra/docker-compose.infra.yml`): MongoDB 7, PostgreSQL 16 with pgvector extension, Redis 7 Alpine.
- **6 Application Containers** (`infra/docker-compose.yml`):
  - `@supportpilot/ticket-service` (Node 22 / NestJS / Express)
  - `@supportpilot/ai-service` (Python 3.12 / FastAPI / PyTorch CPU / SBERT `sentence-transformers/all-MiniLM-L6-v2`)
  - `@supportpilot/notification-service` (Node 22 / BullMQ / Nodemailer / MailHog)
  - `@supportpilot/gateway` (Node 22 / Reverse Proxy & WebSocket routing)
  - `@supportpilot/web` (Nginx 1.27 + Vite React production build)
  - `@supportpilot/widget` (Nginx 1.27 + Vite React customer widget)
- Database migrations and seed data execution (`pnpm db:seed`).

On standard GitHub-hosted runners (2 vCPUs, 7 GB RAM):
- Compiling PyTorch CPU inside Docker and performing multiple concurrent multi-stage `pnpm install` Docker builds exhausts runner memory (OOMKilled) and routinely exceeds the 20-minute CI workflow timeout budget.
- Running 9 persistent container processes concurrently alongside Playwright browser automation causes severe CPU throttling, port contention, and socket timeouts.

Therefore, the `live` Playwright suite is maintained as a **documented local-only suite** and configured in GitHub Actions (`.github/workflows/e2e.yml`) as an on-demand job guarded by `if: github.event_name == 'workflow_dispatch'`.

### Running the Live Suite Locally
1. Start infrastructure and application containers:
   ```bash
   docker network create supportpilot-net || true
   docker compose -f infra/docker-compose.infra.yml up -d
   docker compose -f infra/docker-compose.yml up -d --build
   ```
2. Verify all services are healthy:
   ```bash
   docker ps
   ```
3. Run database seed:
   ```bash
   pnpm db:seed
   ```
4. Execute Playwright live test project:
   ```bash
   npx playwright test --config tests/e2e/playwright.config.ts --project=live
   ```
5. Teardown stack:
   ```bash
   docker compose -f infra/docker-compose.yml down
   docker compose -f infra/docker-compose.infra.yml down
   ```
