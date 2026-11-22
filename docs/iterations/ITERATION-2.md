# Build Iteration 2: Real-Time Chat & Hybrid RAG Assistant

- **Build Window**: 2026-11-20
- **Starting Commit**: `3bf8e43` (_socket.io on gateway with jwt and visitor handshake, rooms, and redis adapter_)
- **Ending Commit**: `1dee06b` (_Cypress & Playwright E2E suites and Sprint 2 exit gate verification_)
- **Execution Model**: Single continuous iteration (~5 hours elapsed)

## Goals & Objectives

Implement real-time bidirectional messaging, customer chat widget, hybrid knowledge base retrieval, and automated RAG responses.

## Commits & Implemented Capabilities

- `3bf8e43`: Socket.IO on API gateway with Redis Pub/Sub adapter and tenant-isolated room namespaces.
- `50dbb3f`: Monotonic sequence ordering (`seq`) with reconnect delta replay avoiding message loss.
- `398094a`: Typing indicators, presence broadcasts, and read receipts.
- `781ba46`: Embeddable customer portal and chat widget running on port 5174.
- `3d29930`: S3-compatible presigned upload pipeline with magic byte file type validation.
- `7d882f3`: FastAPI `ai-service` setup with Pydantic validation and health endpoints.
- `4ceb028`: Markdown document chunker, PostgreSQL pgvector storage, and idempotent ingestion.
- `bd2db5c`: Hybrid retrieval merging dense vectors with BM25 full-text search via Reciprocal Rank Fusion ($k=60$).
- `586ea5f`: `/v1/answer` RAG generation endpoint with strict JSON schema repair, citation attribution, and confidence escalation.
- `3ed91f2`: Live chat human agent handoff with conversation transcript transfer.
- `020b496`: Redis semantic cache for frequent customer inquiries.
- `d8b2d0b`: Initial evaluation runner with golden question dataset and regression thresholding.
- `9bc9c20`: Gateway Apollo Server GraphQL schema with DataLoader batching and query depth analysis.
- `3a7ca39`: Web dashboard knowledge base explorer and live agent chat panel.
- `1dee06b`: Playwright and Cypress end-to-end browser test suites.

## Key Outcomes & Verification

- Chat latency benchmarked under multi-socket load.
- RAG grounding verified with mandatory citation attribution.
- Zero cross-tenant data leaks in GraphQL queries.
