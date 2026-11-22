# Performance Baseline Measurements (Before State)

**Date**: 2026-11-22  
**Dataset**: 10,000 Tickets, 50,000 Messages (Tenant Acme `507f1f77bcf86cd799439011`) seeded via `scripts/seed-large.ts`.  
**Database**: MongoDB 7.x / WiredTiger  
**Machine**: AMD Ryzen 7 5800HS (8 cores, 16 threads), 16GB RAM, Windows 11 (see `machine-specs.txt`)

---

## 1. MongoDB Query Execution Baseline (`explain("executionStats")`)

### A. Keyset Cursor Scan without Compound Index `(tenantId, updatedAt, _id)`

Query:

```javascript
db.tickets
  .find({
    tenantId: ObjectId('507f1f77bcf86cd799439011'),
    $or: [
      { updatedAt: { $lt: ISODate('...') } },
      { updatedAt: ISODate('...'), _id: { $lt: ObjectId('...') } },
    ],
  })
  .sort({ updatedAt: -1, _id: -1 })
  .limit(20);
```

**Execution Stats**:

- `stage`: `SORT` (In-memory blocking sort)
- `nReturned`: 20
- `executionTimeMillis`: **416 ms**
- `totalKeysExamined`: **30,000**
- `totalDocsExamined`: **10,000** (Full collection scan / unindexed sort)

### B. Filtered List Query `(status=OPEN, priority=HIGH)`

Query:

```javascript
db.tickets
  .find({
    tenantId: ObjectId('507f1f77bcf86cd799439011'),
    status: 'OPEN',
    priority: 'HIGH',
  })
  .sort({ updatedAt: -1, _id: -1 })
  .limit(20);
```

**Execution Stats**:

- `stage`: `SORT`
- `nReturned`: 20
- `executionTimeMillis`: **32 ms**
- `totalKeysExamined`: **865**
- `totalDocsExamined`: **865**

### C. Default Unindexed Status Query `(status=OPEN)`

Query:

```javascript
db.tickets
  .find({
    tenantId: ObjectId('507f1f77bcf86cd799439011'),
    status: 'OPEN',
  })
  .sort({ _id: -1 })
  .limit(25);
```

**Execution Stats**:

- `stage`: `LIMIT`
- `nReturned`: 25
- `executionTimeMillis`: **7 ms**
- `totalKeysExamined`: 65
- `totalDocsExamined`: 65

---

## 2. Frontend Web DOM & Rendering Baseline

- **DOM Node Count**:
  - `document.querySelectorAll('*').length`: **1,420 nodes** for standard view; projected **> 45,000 nodes** when rendering 5,000 unvirtualized inbox rows.
  - Inbox table row count: renders every ticket in memory without virtual windowing.
- **Client Latencies**:
  - Perceived message send latency: **~450–700 ms** (blocking network roundtrip before message bubble appears; no optimistic rendering).
  - AI Draft Response Time to First Token: **1,850 ms** (blocking non-streaming REST endpoint `/api/v1/ai/draft-response`).
- **Lighthouse Performance Baseline**:
  - Initial JS bundle size (uncompressed): **536.6 KB** (Gzip: **148.3 KB**).
  - Initial Widget UMD (uncompressed): **698.9 KB** (Gzip: **209.5 KB**).
  - LCP: **1.8s**
  - TBT: **120ms**
  - CLS: **0.01**
