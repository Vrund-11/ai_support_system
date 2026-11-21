# DevOps, CI/CD, Kubernetes, Emulated AWS

## docker-compose (infra/docker/docker-compose.yml, starting point)

```yaml
services:
  mongo:
    image: mongo:7
    ports: ['27017:27017']
    volumes: [mongo-data:/data/db]
  postgres:
    image: pgvector/pgvector:pg16
    environment: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: supportpilot }
    ports: ['5432:5432']
    volumes: [pg-data:/var/lib/postgresql/data]
  redis:
    image: redis:7
    ports: ['6379:6379']
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: test, MINIO_ROOT_PASSWORD: testtest123 }
    ports: ['9000:9000', '9001:9001']
    volumes: [minio-data:/data]
  mailhog:
    image: mailhog/mailhog
    ports: ['1025:1025', '8025:8025']
  # Optional emulator (check current licensing): LocalStack for SQS/Lambda/SSM
  # localstack:
  #   image: localstack/localstack
  #   ports: ["4566:4566"]
  #   environment: { SERVICES: "s3,sqs,lambda,ssm" }
volumes: { mongo-data: {}, pg-data: {}, minio-data: {} }
```

A second file `docker-compose.apps.yml` (profile `apps`) adds gateway, ticket-service, ai-service, notification-service and web built from Dockerfiles, with healthchecks and `depends_on: condition: service_healthy`.

## Dockerfile pattern (Node service)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/ticket-service/package.json apps/ticket-service/
RUN corepack enable && pnpm install --frozen-lockfile --filter ticket-service...

FROM deps AS build
COPY apps/ticket-service apps/ticket-service
RUN pnpm --filter ticket-service build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 4001
HEALTHCHECK CMD wget -qO- http://localhost:4001/health || exit 1
CMD ["node", "apps/ticket-service/dist/index.js"]
```

Python service: `python:3.12-slim`, install from lockfile, run `uvicorn app.main:app --host 0.0.0.0 --port 4002`, non-root user, pre-download the embedding model in a build layer or on first request (lazy).

## Kubernetes (infra/k8s)

```
k8s/
  kind-config.yaml            # extraPortMappings 80/443 for ingress
  base/
    namespace.yaml
    gateway/ {deployment,service,hpa,configmap}.yaml
    ticket-service/ ...
    ai-service/ ...
    notification-service/ ...
    web/ ...
    ingress.yaml
    networkpolicy.yaml        # only gateway can reach internal services
    pdb.yaml
  overlays/
    staging/ kustomization.yaml (image tags, replicas, config patches)
    prod/    kustomization.yaml
  jobs/ migrate-job.yaml, eval-cronjob.yaml
```

Deployment checklist per service: readiness and liveness probes (`/ready`, `/health`), resource requests and limits, `securityContext` (runAsNonRoot, readOnlyRootFilesystem where possible), env from ConfigMap and Secret, 2 replicas for gateway, HPA 2 to 5 at 70% CPU.
Local flow:

```
kind create cluster --config infra/k8s/kind-config.yaml
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
docker build -t sp/gateway:dev apps/gateway && kind load docker-image sp/gateway:dev
kubectl apply -k infra/k8s/overlays/staging
```

Datastores in-cluster for the demo use StatefulSets with PVCs or stay as compose containers reached through `host.docker.internal`; document the choice in an ADR.

## GitHub Actions

`ci.yml` (pull_request):

```yaml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      mongo: { image: 'mongo:7', ports: ['27017:27017'] }
      redis: { image: 'redis:7', ports: ['6379:6379'] }
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: '**/coverage' }
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r apps/ai-service/requirements.txt
      - run: ruff check apps/ai-service && pytest apps/ai-service/tests
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm audit --prod || true # decide policy; do not hide real findings
      - uses: aquasecurity/trivy-action@master
        with: { scan-type: fs, severity: 'CRITICAL,HIGH' }
```

Other workflows: `e2e.yml` (compose up, wait for health, Cypress + Playwright, upload videos), `perf.yml` (nightly k6, upload summary), `ai-eval.yml` (path filter `apps/ai-service/**`), `deploy-staging.yml` (build images, push to GHCR, apply Kustomize to a kind cluster started in the job for smoke tests), `mobile.yml` (EAS preview build). Use caching, concurrency groups, and least-privilege `permissions:`.

## Terraform against emulated AWS (infra/aws/terraform)

Resources: S3 bucket (private, lifecycle rule), SQS queue + DLQ, Lambda function (webhook delivery) with event source mapping, IAM role and policy, SSM parameters. Use `tflocal` (Terraform LocalStack wrapper) or provider endpoint overrides pointing at the emulator. Keep policies in `infra/aws/iam/*.json` following least privilege. Add `README` explaining differences from real AWS.

## Lambda (webhook-lambda)

Handler `index.handler(event)`: read SQS records, sign body with HMAC-SHA256, POST to subscriber with timeout 5s, throw on non-2xx so SQS retries, DLQ after 6 receives. Develop with `sam local invoke` and a sample event in `events/`.

## Observability stack (compose profile `obs`)

Prometheus scraping `/metrics`, Grafana with provisioned dashboards (`infra/grafana/*.json`), Loki + promtail for logs, OpenTelemetry collector for traces (Jaeger or Tempo). Dashboards: API latency and errors, queue depth and failures, LLM tokens and cache hit rate, socket connections, SLA breaches.

## Release process

Conventional commits drive changelog; tag `vX.Y.Z`; staging deploy on merge; production-like deploy on manual approval; rollback by `kubectl rollout undo` or redeploying previous tag.
