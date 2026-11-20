# Architecture and Repository Structure

## Services and ports (local)

| Service                    | Port        | Stack                      | Owns                             |
| -------------------------- | ----------- | -------------------------- | -------------------------------- |
| web (dashboard)            | 5173        | React 19 + Vite            | none                             |
| widget (dev server)        | 5174        | React + Vite lib           | none                             |
| gateway                    | 4000        | Express, Apollo, Socket.IO | Redis (sessions, rate limits)    |
| ticket-service             | 4001        | Express + Mongoose         | MongoDB                          |
| ai-service                 | 4002        | FastAPI                    | Postgres (pgvector), model files |
| notification-service       | 4003        | Node + BullMQ              | Redis queues, audit log          |
| webhook-lambda (SAM local) | 3001        | Node Lambda handler        | none                             |
| MongoDB                    | 27017       | mongo:7                    |                                  |
| Postgres                   | 5432        | pgvector/pgvector:pg16     |                                  |
| Redis                      | 6379        | redis:7                    |                                  |
| MinIO                      | 9000 / 9001 | S3 API / console           |                                  |
| MailHog                    | 1025 / 8025 | SMTP / UI                  |                                  |
| Prometheus / Grafana       | 9090 / 3000 |                            |                                  |

Only the gateway is exposed to clients. Internal calls carry `x-service-token`.

## Monorepo tree

```
supportpilot/
  apps/
    web/                    React dashboard
    widget/                 embeddable chat widget
    mobile/                 Expo agent app
    gateway/                GraphQL + REST + Socket.IO
    ticket-service/         tickets, conversations, users, tenants, analytics
    notification-service/   BullMQ workers (push, email, SLA, webhooks)
    ai-service/             FastAPI (RAG, classifier, ingestion)
    webhook-lambda/         Lambda handler for signed webhooks
  packages/
    shared-types/           TS types
    validators/             Zod schemas
    api-client/             typed client for web and mobile
    eslint-config/
  infra/
    docker/                 Dockerfiles, compose files
    k8s/                    base + overlays (staging, prod)
    aws/                    terraform/, iam/, sam/
    grafana/                dashboards JSON
  tests/
    e2e/                    cypress/, playwright/
    perf/                   k6 scripts
    api/                    postman collections
    ai-eval/                golden sets, runner
  docs/                     this planning pack, ADRs, retros, runbooks
  .github/                  workflows, templates
  package.json, pnpm-workspace.yaml, turbo.json
```

## Layering inside each Node service

`routes/resolvers -> controllers -> services -> repositories -> models`. Only repositories touch the database and always receive `tenantId`. Cross-cutting: `middleware/` (auth, rbac, rate-limit, validation, error), `lib/` (logger, redis, queue, s3), `config/` (env parsing with Zod, fail fast at startup).

## Request flow: customer message

1. Widget connects to gateway Socket.IO with a visitor token.
2. `message:send` -> gateway validates, forwards to ticket-service `POST /internal/messages`.
3. ticket-service persists with next `seq`, returns message.
4. If conversation state is `AI`, gateway calls ai-service `POST /v1/answer`.
5. Answer persisted as AI message and emitted to the room. If `shouldEscalate`, ticket-service sets `WAITING_AGENT`, creates/links ticket, and enqueues `notifications` job.
6. notification-service pushes to agents (socket, FCM, email).

## Request flow: KB ingestion

1. Dashboard asks `POST /kb/uploads/presign`, uploads directly to S3-compatible storage.
2. Dashboard calls `POST /kb/documents`; gateway enqueues `ingestion` job.
3. ai-service downloads file, extracts, chunks, embeds, writes chunks, updates status.
4. Gateway emits `kb:ingestion` event to the tenant room.

## Environment variables (names)

```
NODE_ENV, PORT, LOG_LEVEL
MONGODB_URI, DATABASE_URL, REDIS_URL
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SERVICE_TOKEN, WEBHOOK_SIGNING_SECRET
ALLOWED_ORIGINS
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
S3_ENDPOINT, S3_BUCKET, S3_FORCE_PATH_STYLE, SQS_ENDPOINT, LAMBDA_ENDPOINT
LLM_PROVIDER (mock|gemini|openai), GEMINI_API_KEY, OPENAI_API_KEY
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
FCM_SERVICE_ACCOUNT_JSON, RESEND_API_KEY or SMTP_URL
```

Each service validates its own env with Zod or Pydantic at boot.
