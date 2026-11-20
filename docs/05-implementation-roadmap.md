# Implementation Roadmap

Legend: [ ] todo, [x] done. Task id format `S<sprint>-T<nn>`. Priority P0/P1/P2 from the PRD. "AC" = acceptance criteria. Always add tests listed.

## Sprint 0: Foundations (before coding features)

- [x] S0-T01 Create monorepo (pnpm workspaces, Turborepo, TS configs, ESLint, Prettier, Husky). AC: `pnpm verify` runs lint, type-check, test across empty packages.
- [x] S0-T02 Commit `docs/` planning pack and PRD. AC: README links work.
- [x] S0-T03 `infra/docker/docker-compose.yml` with mongo, postgres(pgvector), redis, minio, mailhog. AC: `docker compose up -d` healthy; `scripts/dev-up.sh` creates bucket.
- [x] S0-T04 `.env.example` and Zod env loader shared package. AC: service fails fast on missing env.
- [x] S0-T05 CI skeleton `.github/workflows/ci.yml` (install, lint, type-check, test). AC: green on a trivial PR.
- [x] S0-T06 Logger (pino), request-id middleware, error handler (RFC 7807) in shared lib. AC: unit tests.
- [x] S0-T07 GitHub Project board, labels, issue and PR templates.

## Sprint 1: MERN core (weeks 1-2)

- [x] S1-T01 ticket-service skeleton, Mongoose connection, health endpoints. (FR: TEN-1)
- [x] S1-T02 Tenant + user models, register tenant flow (creates owner, default settings). (TEN-2, AUTH-1)
- [x] S1-T03 Auth: bcrypt, JWT access, refresh rotation with Redis hash store, logout revoke. (AUTH-2) Tests: rotation, reuse detection, expiry.
- [x] S1-T04 RBAC middleware with deny-by-default and role matrix tests. (AUTH-3)
- [x] S1-T05 Tenant-scoped repository base class (injects tenantId, forbids unscoped queries). (TEN-1) Tests: cross-tenant read/update/delete fail.
- [x] S1-T06 Ticket model, counters, create/list/get/update with version check. (TKT-1,3,9)
- [x] S1-T07 Status transition map + property-based test with fast-check. (TKT-2)
- [x] S1-T08 Messages and internal notes, ticket events timeline. (TKT-5,10)
- [x] S1-T09 Search and filters with compound and text indexes; record `explain()` before/after in evidence tracker. (TKT-7)
- [x] S1-T10 Gateway skeleton: auth passthrough, rate limiting (Redis), request validation, proxy to ticket-service. (AUTH-5)
- [x] S1-T11 Web dashboard: login, inbox list with filters, ticket detail with reply and notes (React, TanStack Query, Zustand, Tailwind). AC: works against gateway.
- [x] S1-T12 Jest/Vitest unit + Supertest integration (Testcontainers) for all above; coverage report artifact in CI.
- [x] S1-T13 Postman collection for auth + tickets, run with Newman in CI.
- [x] S1-T14 Deploy sprint-1 demo to a free host (Render/Vercel) or document local demo script. Update progress log.
      Exit: P0 ticketing works end to end, coverage >= 70% on ticket-service.

## Sprint 2: Realtime and AI (weeks 3-4)

- [x] S2-T01 Socket.IO on gateway with JWT/visitor handshake, rooms, Redis adapter. (CHAT-1,2,7)
- [x] S2-T02 Per-conversation sequence numbers (`seq:{id}` Redis INCR) and replay on join. (CHAT-6) Test: disconnect/reconnect no loss, no duplicates.
- [x] S2-T03 Typing, presence, read receipts. (CHAT-3)
- [x] S2-T04 Widget app: bubble, chat UI, offline form, theming; embed script. (CHAT-1,5)
- [x] S2-T05 Presigned upload endpoint using AWS SDK v3 against MinIO/LocalStack; attachments in chat and tickets. (KB-1) Test: spoofed extension rejected via magic bytes.
- [x] S2-T06 ai-service skeleton (FastAPI), config, health, mock LLM provider interface.
- [x] S2-T07 Ingestion worker: extract, chunk, embed (lazy-loaded model), write to pgvector, status updates. (KB-2,3,5) Tests: chunker unit tests, idempotent re-ingest.
- [x] S2-T08 Hybrid retrieval with RRF and tenant filter. Test: tenant isolation in vector queries. (AI-1)
- [x] S2-T09 `/v1/answer` with prompt builder, JSON validation + repair retry, citation verification, confidence and thresholds. (AI-1,2,3,9)
- [x] S2-T10 Handoff flow: low confidence/blocklist/human request -> WAITING_AGENT + ticket with transcript. (CHAT-4)
- [x] S2-T11 Semantic cache in Redis; invalidate on KB change. (AI-7)
- [x] S2-T12 Eval harness v1: 100-question golden set, metrics, baseline stored in `ai_eval_runs`. (AI-10)
- [x] S2-T13 GraphQL layer on gateway (queries, mutations, subscriptions, DataLoader, depth/complexity limits). (INT-3)
- [x] S2-T14 Dashboard: KB page (upload, status), live chat view with AI suggestion panel placeholder, GraphQL via Apollo Client.
- [x] S2-T15 Cypress E2E: login, create ticket, live chat handoff. Playwright: widget on a static host page.
      Exit: customer chats with AI, escalates to agent in real time; eval baseline recorded.

## Sprint 3: Platform and quality (weeks 5-6)

- [x] S3-T01 notification-service with BullMQ queues, retries, backoff, DLQ, idempotent consumers. (NOTIF-5)
- [x] S3-T02 SLA policy calculator (business hours) + delayed jobs 75%/100%; skip if ticket already resolved. (AUTO-1,2) Property tests.
- [x] S3-T03 Rules engine (conditions -> actions) with tests. (AUTO-3)
- [x] S3-T04 Classifier: dataset prep, training notebook, model comparison, artifact export, `/v1/classify`, rules fallback. (AI-4) See `08-ai-ml-plan.md`.
- [x] S3-T05 Agent assist: suggest-reply and summarize endpoints + UI. (AI-5,6)
- [x] S3-T06 Email via MailHog/SMTP; verification and reset flows. (AUTH-4, NOTIF-3)
- [x] S3-T07 Analytics aggregation pipelines + dashboard charts. (ANL-1..4) Record explain/latency.
- [x] S3-T08 Dockerfiles (multi-stage, non-root) for all services; compose profile for full stack.
- [x] S3-T09 Kubernetes: kind config, Kustomize base+overlays, probes, HPA, NetworkPolicy, ingress-nginx. See `07`.
- [x] S3-T10 GitHub Actions: ci, e2e, perf (nightly), ai-eval, deploy-staging (to kind in CI or GHCR push), Trivy scan, dependency audit.
- [x] S3-T11 k6 scripts: ticket list, chat fan-out, AI endpoint with mock LLM. Store summaries as artifacts.
- [x] S3-T12 AWS-compatible pieces: webhook Lambda (SAM local) fed by SQS (LocalStack/ElasticMQ); Terraform + tflocal for bucket, queue, Lambda, IAM policies. (INT-2)
- [x] S3-T13 Observability: pino logs, Prometheus metrics, Grafana dashboards, OpenTelemetry tracing across services.
- [x] S3-T14 Security pass: cross-tenant suite, rate-limit tests, prompt-injection tests, CSP/CORS/Helmet.
      Exit: full pipeline green, cluster runs on kind, performance and test reports archived.

## Sprint 4: Mobile and polish (weeks 7-8)

- [ ] S4-T01 Expo app skeleton, Expo Router, auth with secure store and biometrics. (MOB-1)
- [ ] S4-T02 Inbox, ticket/chat screens with Socket.IO and TanStack Query. (MOB-2,3)
- [ ] S4-T03 FCM push (dev client), token registration, deep links. (MOB-4, NOTIF-2)
- [ ] S4-T04 Quick actions, AI suggestion insert, presence toggle. (MOB-5,7)
- [ ] S4-T05 Offline outbox. (MOB-6)
- [ ] S4-T06 EAS Build preview profile; Fastlane lanes; GitHub Actions `mobile.yml`. See `09`.
- [ ] S4-T07 Webhooks management UI, API keys, audit log view. (INT-1,2, ADM-2)
- [ ] S4-T08 Platform admin console, feature flags. (ADM-1,3) (P2 optional)
- [ ] S4-T09 Docs: README with screenshots, architecture diagram (Mermaid), runbook, demo video script.
- [ ] S4-T10 Final test and traceability matrix sweep; fix gaps; tag v1.0.0.
- [ ] S4-T11 Fill `10-resume-evidence-tracker.md` from real reports; update resumes.
      Exit: acceptance checklist in PRD section 22 satisfied.

## Cut order if time runs short

Drop first: S4-T08, canned replies, CSV export, OAuth, public help center. Then offline outbox, Terraform. Never cut: tenant isolation, tests, CI, eval harness.
