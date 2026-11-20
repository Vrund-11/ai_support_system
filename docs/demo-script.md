# SupportPilot Demo Script & Walkthrough

This document outlines the step-by-step demonstration flow for showcasing SupportPilot end-to-end to stakeholders, interviewers, or technical leads.

---

## Overview

- **Product:** SupportPilot Multi-Tenant AI Customer Support Platform
- **Demo Duration:** ~8-10 minutes
- **Roles Featured:** Customer / Website Visitor, Support Agent, Team Lead, Tenant Owner / Platform Admin
- **Environments:** Local Docker Compose / Kind Kubernetes + Expo Mobile Dev Client

---

## Step-by-Step Demo Flow

### Scene 1: Multi-Tenant Setup & Seed Data (0:00 - 1:15)

1. **Terminal:**
   - Run `pnpm db:seed` to show automated provisioning of 3 isolated tenants:
     - `acme-corp` (Enterprise, #4f46e5 brand)
     - `globex-logistics` (Growth, #059669 brand)
     - `initech` (Starter, #d97706 brand)
   - Note data-access layer isolation: every Mongoose model, PostgreSQL query, Redis room, and MinIO S3 bucket key enforces `tenantId`.

2. **Web Dashboard (`http://localhost:3000`):**
   - Log in as `owner@acme.com` / `Password123!`.
   - Show Tenant Brand and business hours configured in Settings.

---

### Scene 2: Customer Live Chat & Hybrid RAG Deflection (1:15 - 3:00)

1. **Visitor Chat Widget (`apps/widget/index.html`):**
   - Open widget embed demo page.
   - Click floating chat bubble.
   - Customer types: _"How do I configure business hours for SLA timers?"_
2. **AI Service Processing:**
   - Behind the scenes:
     - Hybrid retrieval: BM25 keyword search + pgvector 384-dimensional cosine similarity.
     - Reciprocal Rank Fusion (RRF with $k=60$) merges top chunks.
     - Citation verification ensures zero hallucination ($100\%$ groundedness on golden test set).
     - Semantic cache (Redis) stores answer fingerprint for sub-millisecond replay on repeat questions.
3. **Widget Response:**
   - Show synthesized answer with labeled citation chips `[chunk:art-2]`.

---

### Scene 3: Low-Confidence / Keyword Escalation to Human Agent (3:00 - 4:30)

1. **Widget:**
   - Customer types: _"My card was charged twice and I want an immediate refund, let me talk to someone."_
   - Keywords `refund`/`charged twice` trigger automatic escalation criteria.
   - Chat transitions conversation state to `WAITING_AGENT`.
   - Widget notifies customer: _"Transferring you to an agent. Ticket created."_
2. **Web Dashboard (Live Chats):**
   - Open **Live Chats** tab (`apps/web`).
   - Conversation immediately appears in "Waiting Queue".
   - Notice Socket.IO monotonic sequence replay ($seq:\{convId\}$): zero dropped messages upon agent takeover.

---

### Scene 4: Agent Assist: Suggest-Reply & Thread Summarization (4:30 - 6:00)

1. **Agent Takeover:**
   - Agent clicks "Take Over Conversation".
   - Conversation moves to "My Chats".
2. **AI Suggestion Panel:**
   - Click "Generate Suggestion".
   - AI service evaluates full conversation context against the knowledge base and generates a grounded response:
     _"I apologize for the duplicate charge. I've initiated a full reversal of transaction #... which will appear in 3-5 business days."_
   - Click **"Insert into Reply"** — drafts reply into composer in 1 click.
3. **Ticket Detail Summarization:**
   - Open the escalated ticket in **Inbox**.
   - Click "Summarize Thread with AI".
   - Output displays:
     - **Sentiment:** `FRUSTRATED`
     - **Key Points:** 2 bullet points detailing billing issue
     - **Recommended Action:** Execute Stripe refund and confirm via email

---

### Scene 5: SLA Policy Calculator & Delayed Timers (6:00 - 7:00)

1. **SLA Configuration:**
   - Navigate to Settings -> SLA Policies.
   - High Priority SLA: 1 hour first response, 4 hours resolution within business hours ($09:00 - 17:00$ Mon-Fri).
2. **BullMQ Automation Engine:**
   - Show delayed job queues in `notification-service`:
     - 75% warning timer fires at 45 minutes elapsed.
     - 100% breach timer fires at 60 minutes elapsed.
   - Resolve ticket: note that active SLA warning/breach timers are idempotently canceled upon resolution (T-SLA-01 invariant).

---

### Scene 6: ML Priority Classifier & Rules Fallback (7:00 - 8:00)

1. **Classifier Demonstration:**
   - Create ticket with subject: _"Production database connection pool exhausted, site is completely down"_.
   - Machine Learning pipeline (`joblib` TF-IDF + Logistic Regression):
     - Priority: `URGENT` (Confidence 0.96)
     - Category: `bug` (Confidence 0.99)
   - Rules fallback kicks in seamlessly for high-risk outage keywords if model confidence is borderline.

---

### Scene 7: Mobile Agent App & Fastlane Pipeline (8:00 - 9:00)

1. **Expo Mobile App (`apps/mobile`):**
   - Launch Expo app.
   - Authenticate with biometrics (FaceID/TouchID unlock via `LocalAuthentication`).
   - Inspect Ticket Inbox with pull-to-refresh.
   - Open ticket chat and send reply.
2. **Offline Outbox Demonstration:**
   - Toggle airplane mode / disconnect network.
   - Type message: _"Checking on this now."_
   - Message enqueues in persistent local AsyncStorage Outbox.
   - Reconnect network: Outbox automatically flushes with deduplication keys.
3. **CI/CD Mobile Pipeline:**
   - Highlight GitHub Actions `.github/workflows/mobile.yml` and `Fastfile` with automated EAS preview builds and TestFlight lanes.

---

### Scene 8: Security, Integrations & Observability (9:00 - 10:00)

1. **Settings -> API Keys & Webhooks:**
   - Create API Key with scopes (`tickets:read`, `tickets:write`).
   - Demonstrate raw key shown once with copy button, hashed with SHA-256 in MongoDB.
   - Send Test Ping to Webhook endpoint: verify `x-supportpilot-signature: sha256=...` HMAC-SHA256 delivery.
2. **Audit Log:**
   - Show immutable audit trail capturing user actions, IP addresses, and timestamps.
3. **Observability (`http://localhost:3005`):**
   - Open Grafana Dashboards:
     - **Overview Dashboard:** HTTP RPS, error rates, p95 latency.
     - **AI Analytics Dashboard:** Semantic cache hit ratio, token usage, classifier throughput.
     - **Queues & SLA Dashboard:** BullMQ job throughput, SLA breach counts.
4. **Wrap-up:** Point to 400+ automated tests passing with 100% green CI pipeline.
