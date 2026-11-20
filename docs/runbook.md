# SupportPilot Operational Runbook

Production operations, deployment procedures, health monitoring, and disaster recovery procedures.

---

## 1. Architecture & Port Mapping

| Service                  | Port        | Internal DNS (Docker/K8s)   | Description                                |
| ------------------------ | ----------- | --------------------------- | ------------------------------------------ |
| **Web Dashboard**        | 3000        | `web:80`                    | React 19 SPA served via Nginx              |
| **API Gateway**          | 4000        | `gateway:4000`              | Express, Apollo GraphQL, Socket.IO         |
| **Ticket Service**       | 4001        | `ticket-service:4001`       | Mongoose MongoDB ticket & tenant service   |
| **AI Service**           | 8000        | `ai-service:8000`           | FastAPI, pgvector, scikit-learn classifier |
| **Notification Service** | 4003        | `notification-service:4003` | BullMQ Redis worker (email, push, SLA)     |
| **Prometheus**           | 9090        | `prometheus:9090`           | Metrics scraper & timeseries DB            |
| **Grafana**              | 3005        | `grafana:3000`              | Observability dashboards (admin/admin)     |
| **MongoDB**              | 27017       | `mongo:27017`               | Multi-tenant core datastore                |
| **PostgreSQL**           | 5432        | `postgres:5432`             | pgvector knowledge base chunk storage      |
| **Redis**                | 6379        | `redis:6379`                | Socket.IO adapter, BullMQ, semantic cache  |
| **MinIO (S3)**           | 9000        | `minio:9000`                | S3-compatible attachment storage           |
| **MailHog**              | 1025 / 8025 | `mailhog:1025`              | Local SMTP server & web inbox              |

---

## 2. Health Checks & Probes

All microservices expose standard Kubernetes probes:

- **Liveness Probes:**
  - `GET /health` (Node services)
  - `GET /healthz` (AI service)
  - Expected response: HTTP `200 OK` `{"status":"ok"}`
- **Readiness Probes:**
  - `GET /ready` (Node services — checks MongoDB, Redis, or BullMQ readiness)
  - `GET /readyz` (AI service — checks PostgreSQL pgvector & Redis connections)
  - Expected response: HTTP `200 OK` `{"status":"ready"}`
- **Prometheus Metrics:**
  - `GET /metrics` (Exposed across all Node and Python services)

---

## 3. Database Seeding & Maintenance

### Seed Datastores

To seed fresh demo tenants (`acme-corp`, `globex-logistics`, `initech`), 50 realistic tickets, rules, and flags:

```bash
pnpm db:seed
```

### MongoDB Backups

```bash
docker exec supportpilot-mongo mongodump --out /data/backup/$(date +%F)
```

### pgvector Knowledge Base Re-indexing

To rebuild HNSW vector indexes:

```sql
REINDEX INDEX CONCURRENTLY kb_chunks_embedding_idx;
```

---

## 4. Disaster Recovery & Troubleshooting

### Redis Cache Purge & Desync

If Socket.IO presence counters or sequence numbers become desynchronized:

```bash
# Invalidate semantic cache for a specific tenant
curl -X POST http://localhost:8000/v1/cache/invalidate -H "Content-Type: application/json" -d '{"tenantId":"507f1f77bcf86cd799439011"}'
```

### BullMQ Dead-Letter Queue (DLQ) Recovery

Inspect and replay stalled or failed notification jobs:

```bash
# List DLQ items for tenant
curl http://localhost:4003/api/v1/dlq -H "x-service-token: default-service-token" -H "x-tenant-id: 507f1f77bcf86cd799439011"

# Replay DLQ job
curl -X POST http://localhost:4003/api/v1/dlq/<jobId>/replay -H "x-service-token: default-service-token"
```

### Rate Limiting Lockouts

If an IP is blocked due to 5 failed login attempts in 15 minutes:

```bash
redis-cli KEYS "rl:login:*" | xargs redis-cli DEL
```

---

## 5. Kubernetes Kind Deployment

To deploy locally to a Kind cluster with ingress-nginx:

```bash
# 1. Create Kind cluster with ingress port mappings (80/443)
kind create cluster --config infra/k8s/kind-config.yaml

# 2. Deploy Ingress-NGINX
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 3. Apply Kustomize staging overlay
kubectl apply -k infra/k8s/overlays/staging/

# 4. Verify rollout
kubectl rollout status deployment/gateway -n staging
kubectl rollout status deployment/ticket-service -n staging
kubectl rollout status deployment/ai-service -n staging
```
