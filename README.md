# SupportPilot

Multi-tenant, AI-assisted customer-support platform. Tickets, live chat, RAG assistant, agent mobile app.

> **Status:** Sprint 0 — Foundations complete. See [Progress Log](docs/11-progress-log.md).

## Quick start

```bash
# 1. Clone and install
git clone <repo-url> && cd supportpilot
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Start datastores (requires Docker)
./scripts/dev-up.sh
# Or: docker compose -f infra/docker/docker-compose.yml up -d

# 4. Run all services in dev mode
pnpm dev

# 5. Verify everything
pnpm verify   # runs lint + typecheck + test
```

## Architecture

```
Client (Dashboard / Widget / Mobile)
  │
  ▼
Gateway (Express + Apollo + Socket.IO) :4000
  ├── ticket-service (MongoDB)        :4001
  ├── ai-service (FastAPI, pgvector)   :4002
  └── notification-service (BullMQ)    :4003
```

Only the gateway is exposed. Internal calls carry `x-service-token`.

## Monorepo structure

```
apps/
  gateway/              GraphQL + REST + Socket.IO entry point
  ticket-service/       Tickets, conversations, users, tenants
  ai-service/           RAG, classifier, ingestion (Python/FastAPI)
  notification-service/ BullMQ workers (push, email, SLA)
  web/                  React dashboard
  widget/               Embeddable chat widget
  mobile/               Expo agent app
  webhook-lambda/       Lambda handler for signed webhooks
packages/
  shared-types/         TypeScript type definitions
  validators/           Zod schemas + env loader
  shared-lib/           Logger, middleware, error handler
  api-client/           Typed HTTP client
  eslint-config/        Shared ESLint configs
infra/
  docker/               docker-compose.yml
  k8s/                  Kubernetes manifests (Kustomize)
  aws/                  IAM policies, Terraform, SAM
  grafana/              Dashboard JSON
tests/
  e2e/                  Cypress + Playwright
  perf/                 k6 scripts
  api/                  Postman/Newman collections
  ai-eval/              Golden sets + runner
docs/                   PRD, ADRs, planning pack
```

## Planning docs

| File                                                       | Purpose                                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| [AGENTS.md](AGENTS.md)                                     | Rules for AI agents                       |
| [PRD](docs/prd.md)                                         | Full product requirements                 |
| [Architecture](docs/02-architecture-and-repo-structure.md) | Services, ports, repo tree                |
| [Data Models](docs/03-data-models.md)                      | Mongo schemas, Postgres DDL, Redis keys   |
| [API Contracts](docs/04-api-contracts.md)                  | REST, GraphQL, Socket.IO, internal AI API |
| [Roadmap](docs/05-implementation-roadmap.md)               | Sprint-by-sprint tasks                    |
| [Testing Plan](docs/06-testing-plan.md)                    | Strategy, matrix, critical cases          |
| [DevOps](docs/07-devops-cicd-k8s.md)                       | Docker, K8s, CI/CD, Terraform             |
| [AI/ML Plan](docs/08-ai-ml-plan.md)                        | RAG pipeline, classifier, eval            |
| [Mobile Plan](docs/09-mobile-plan.md)                      | Expo, EAS Build, Fastlane                 |
| [Evidence Tracker](docs/10-resume-evidence-tracker.md)     | Measured results for resume               |
| [Progress Log](docs/11-progress-log.md)                    | Current state + session log               |

## Datastores (local via Docker)

| Service               | Port        | Image                  |
| --------------------- | ----------- | ---------------------- |
| MongoDB               | 27017       | mongo:7                |
| PostgreSQL + pgvector | 5432        | pgvector/pgvector:pg16 |
| Redis                 | 6379        | redis:7-alpine         |
| MinIO (S3)            | 9000 / 9001 | minio/minio            |
| MailHog               | 1025 / 8025 | mailhog/mailhog        |

## Scripts

| Command                 | What                                   |
| ----------------------- | -------------------------------------- |
| `pnpm verify`           | Lint + typecheck + test (all packages) |
| `pnpm dev`              | Start all services in watch mode       |
| `pnpm build`            | Build all packages                     |
| `pnpm test`             | Run all tests                          |
| `./scripts/dev-up.sh`   | Start Docker datastores                |
| `./scripts/dev-down.sh` | Stop Docker datastores                 |

## Tech stack

**Backend:** Node 22, Express 5, TypeScript, Mongoose, Apollo Server, Socket.IO, BullMQ, Zod
**AI:** Python 3.12, FastAPI, sentence-transformers, pgvector, scikit-learn
**Frontend:** React 19, Vite, TanStack Query, Zustand, Tailwind CSS, Apollo Client
**Mobile:** Expo, Expo Router, FCM, EAS Build
**Infra:** Docker, Kubernetes (kind), GitHub Actions, Terraform (LocalStack), MinIO, MailHog
**Testing:** Vitest, Supertest, Cypress, Playwright, k6, Postman/Newman, fast-check

## License

Private project — not for redistribution.
