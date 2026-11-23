# Data Models

## MongoDB (ticket-service, Mongoose)

All collections have `tenantId` (ObjectId, indexed first in every compound index), `createdAt`, `updatedAt`.

### tenants

`name, slug (unique), plan (FREE|PRO), settings { brand{color,logoUrl}, businessHours[{day,start,end}], timezone, sla{LOW,MEDIUM,HIGH,URGENT:{firstResponseMin,resolveMin}}, aiEnabled, aiThreshold(0..1) }, widgetKey (hashed), status`

### users

`tenantId, email (unique per tenant), passwordHash, name, role (OWNER|LEAD|AGENT|VIEWER|PLATFORM_ADMIN), status, lastLoginAt, deviceTokens[{token,platform,lastSeen}], notificationPrefs`
Indexes: `(tenantId,email) unique`, `(tenantId,role)`.

### customers

`tenantId, email, name, externalId, visitorIds[], lastSeenAt`
Indexes: `(tenantId,email)`, `(tenantId,visitorIds)`.

### conversations

`tenantId, customerId, channel (WIDGET|API), state (AI|WAITING_AGENT|WITH_AGENT|CLOSED), assignedTo, lastSeq, ticketId, lastMessageAt`
Indexes: `(tenantId,state,lastMessageAt)`, `(tenantId,assignedTo,state)`.

### messages

`tenantId, conversationId, seq, senderType (CUSTOMER|AI|AGENT|SYSTEM), senderId, body, citations[{chunkId,docId,title}], attachments[{key,name,size,mime}], isInternal, readBy[]`
Indexes: `(conversationId,seq) unique`, text index on `body`.

### tickets

`tenantId, number (per-tenant counter), subject, status (NEW|OPEN|PENDING_CUSTOMER|ON_HOLD|RESOLVED|CLOSED), priority (LOW|MEDIUM|HIGH|URGENT), priorityPredicted, category, assigneeId, customerId, conversationId, tags[], customFields{}, sla{firstResponseDue,resolveDue,firstRespondedAt,resolvedAt,breached}, version (optimistic concurrency)`
Indexes: `(tenantId,status,priority,updatedAt)`, `(tenantId,assigneeId,status)`, `(tenantId,number) unique`, text on `subject`.
Allowed transitions:

```
NEW -> OPEN | CLOSED
OPEN -> PENDING_CUSTOMER | ON_HOLD | RESOLVED
PENDING_CUSTOMER -> OPEN | RESOLVED | CLOSED
ON_HOLD -> OPEN | RESOLVED
RESOLVED -> OPEN | CLOSED
CLOSED -> (none)
```

### ticket_events

`tenantId, ticketId, actorId, type (STATUS|PRIORITY|ASSIGN|NOTE|SLA|TAG), from, to, at`

### other

`canned_replies{title,body,variables[]}`, `rules{conditions[],actions[],enabled}`, `api_keys{name,hash,scopes[],lastUsedAt}`, `webhooks{url,events[],secretHash,enabled}`, `counters{tenantId,key,value}`.

## PostgreSQL (ai-service + notification-service)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,           -- upload | paste | url
  s3_key TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|PROCESSING|READY|FAILED
  error TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON kb_documents (tenant_id, status);

CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding vector(384) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX kb_chunks_tenant ON kb_chunks (tenant_id);
CREATE INDEX kb_chunks_tsv ON kb_chunks USING GIN (tsv);
CREATE INDEX kb_chunks_vec ON kb_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE ai_usage (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT,
  model TEXT, prompt_tokens INT, completion_tokens INT,
  latency_ms INT, cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_usage (tenant_id, created_at);

CREATE TABLE ai_eval_runs (
  id BIGSERIAL PRIMARY KEY,
  commit_sha TEXT, groundedness NUMERIC, retrieval_hit_at_5 NUMERIC,
  escalation_precision NUMERIC, p95_latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT, actor_id TEXT, action TEXT NOT NULL,
  entity TEXT, entity_id TEXT, ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (tenant_id, created_at);
```

Hybrid query (every query filters by tenant): vector top-20 with `ORDER BY embedding <=> $1`, full-text top-20 with `ts_rank`, merge with reciprocal rank fusion (k=60).

## Redis keys

```
session:{userId}:{jti}              refresh token hash, TTL 7d
rl:login:ip:{ip}                    sliding window counter
rl:login:acct:{email}               backoff counter
rl:api:{tenantId}:{minute}          per-tenant limit
cache:ai:{tenantId}:{questionHash}  cached answer JSON, TTL 24h
presence:{tenantId}:{userId}        TTL 60s heartbeat
seq:{conversationId}                message sequence counter
idem:{tenantId}:{key}               idempotency record, TTL 24h
bull:* (BullMQ)                     queues: ingestion, ai-reply, notifications, sla-timers, webhooks
```
