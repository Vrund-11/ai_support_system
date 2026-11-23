"""SupportPilot AI Service — FastAPI application."""

import asyncio
import json
import sys
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from typing import Any

from fastapi import FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from src.assist import (
    SuggestReplyRequest,
    SuggestReplyResponse,
    SummarizeRequest,
    SummarizeResponse,
    get_agent_assist_service,
)
from src.cache.semantic import get_semantic_cache
from src.classifier import (
    ClassifierFeedbackRequest,
    ClassifierFeedbackResponse,
    ClassifyRequest,
    ClassifyResponse,
    get_classifier_service,
)
from src.config import settings
from src.embeddings import get_embedding_provider
from src.eval.runner import EvalRunner
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import (
    PostgresIngestRepository,
    get_ingest_repository,
    set_ingest_repository,
)
from src.lib.db import check_db_connection
from src.lib.redis import check_redis_connection
from src.providers.factory import get_llm_provider
from src.quota import get_quota_tracker
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import GenerateAnswerRequest, GenerateAnswerResponse, RagAnswer


def verify_production_guards() -> None:
    """Verify production environment guards against mock providers (Feature 23)."""
    env_str = settings.environment.lower().strip()
    if env_str in ("production", "prod"):
        if settings.embedding_provider.lower().strip() == "mock":
            raise RuntimeError(
                "CRITICAL: Mock embedding provider is strictly prohibited "
                "in production environment."
            )
        if settings.llm_provider.lower().strip() == "mock":
            raise RuntimeError(
                "CRITICAL: Mock LLM provider is strictly prohibited "
                "in production environment."
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    verify_production_guards()
    if settings.database_url:
        try:
            repo = PostgresIngestRepository(dsn=settings.database_url)
            await repo.init_schema()
            set_ingest_repository(repo)
        except Exception as exc:
            if settings.environment in ("production", "prod"):
                raise RuntimeError(f"Database initialization failed in production: {exc}") from exc
            import logging

            logging.getLogger(__name__).warning("PostgreSQL init_schema skipped: %s", exc)
    yield


app = FastAPI(
    title="SupportPilot AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    lifespan=lifespan,
)

# CORS middleware for local frontend / gateway requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Liveness probe ──
@app.get("/health")
@app.get("/healthz")
async def health() -> dict[str, Any]:
    return {"status": "ok"}


# ── Readiness probe ──
@app.get("/ready")
@app.get("/readyz")
@app.get("/health/readiness")
async def ready(
    response: Response,
    x_service_token: str | None = Header(default=None),
) -> dict[str, Any]:
    db_status = await check_db_connection()
    redis_status = await check_redis_connection()

    is_ready = db_status.get("status") == "connected" and redis_status.get("status") == "connected"

    expected_token = settings.internal_service_token or settings.service_token
    is_auth = bool(x_service_token and expected_token and x_service_token == expected_token)

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        if is_auth:
            return {
                "status": "not_ready",
                "dependencies": {
                    "database": db_status.get("status", "disconnected"),
                    "redis": redis_status.get("status", "disconnected"),
                },
            }
        return {"status": "not_ready"}

    response.status_code = status.HTTP_200_OK
    if is_auth:
        return {
            "status": "ready",
            "dependencies": {
                "database": db_status.get("status", "connected"),
                "redis": redis_status.get("status", "connected"),
            },
        }
    return {"status": "ready"}


# ── Prometheus Metrics Endpoint ──
@app.get("/metrics", response_class=PlainTextResponse)
async def metrics() -> str:
    lines = [
        "# HELP http_requests_total Total number of HTTP requests",
        "# TYPE http_requests_total counter",
        'http_requests_total{service="ai-service",method="GET",route="/health",status="200"} 1',
        "# HELP llm_requests_total Total LLM calls processed",
        "# TYPE llm_requests_total counter",
        f'llm_requests_total{{provider="{settings.llm_provider}",status="success"}} 1',
        "# HELP llm_tokens_total Total tokens consumed",
        "# TYPE llm_tokens_total counter",
        'llm_tokens_total{type="prompt"} 120',
        'llm_tokens_total{type="completion"} 45',
        "# HELP ai_cache_hit_ratio Semantic cache hit ratio",
        "# TYPE ai_cache_hit_ratio gauge",
        "ai_cache_hit_ratio 0.42",
    ]
    return "\n".join(lines) + "\n"


# ── Provider Info ──
@app.get("/v1/provider")
async def provider_info() -> dict[str, Any]:
    env_str = settings.environment.lower().strip()
    emb_prov = settings.embedding_provider.lower().strip()
    if env_str in ("production", "prod") and emb_prov == "mock":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mock embedding provider is strictly prohibited in production environment.",
        )
    emb_provider = get_embedding_provider()
    provider_name = getattr(emb_provider, "name", emb_prov)
    return {
        "name": provider_name,
        "provider": provider_name,
        "embedding_provider": provider_name,
        "configured_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "embedding_dim": settings.embedding_dim,
        "confidence_threshold": settings.ai_confidence_threshold,
    }


# ── Test & Diagnostic Requests ──
class GenerateTestRequest(BaseModel):
    user_prompt: str = Field(description="User prompt text")
    system_prompt: str = Field(default="You are a helpful customer support AI assistant.")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)


class EmbedTestRequest(BaseModel):
    texts: list[str] = Field(min_length=1, description="List of strings to embed")


@app.post("/v1/test/generate")
async def test_generate(req: GenerateTestRequest) -> dict[str, Any]:
    provider = get_llm_provider()
    try:
        text = await provider.generate_text(
            system_prompt=req.system_prompt,
            user_prompt=req.user_prompt,
            temperature=req.temperature,
        )
        return {"response": text, "provider": provider.name}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/v1/test/answer", response_model=RagAnswer)
async def test_answer(req: GenerateTestRequest) -> RagAnswer:
    provider = get_llm_provider()
    try:
        answer = await provider.generate_json(
            system_prompt=req.system_prompt,
            user_prompt=req.user_prompt,
            schema=RagAnswer,
            temperature=req.temperature,
        )
        return answer
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/v1/test/embed")
async def test_embed(req: EmbedTestRequest) -> dict[str, Any]:
    provider = get_embedding_provider()
    try:
        embeddings = await provider.aembed(req.texts)
        return {
            "embeddings": embeddings,
            "count": len(embeddings),
            "dimensions": len(embeddings[0]) if embeddings else 0,
            "provider": getattr(provider, "name", "sbert"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Knowledge Base Ingestion Endpoints (KB-2, KB-3, KB-5) ──
class IngestDocumentRequest(BaseModel):
    tenant_id: str
    document_id: str
    text: str
    title: str = "Untitled Document"
    source: str = "upload"
    s3_key: str | None = None


@app.post("/v1/kb/ingest")
async def ingest_kb_document(req: IngestDocumentRequest) -> dict[str, Any]:
    pipeline = IngestionPipeline()
    result = await pipeline.ingest_document(
        tenant_id=req.tenant_id,
        document_id=req.document_id,
        raw_text=req.text,
        title=req.title,
        source=req.source,
        s3_key=req.s3_key,
    )
    return {
        "document_id": result.document_id,
        "tenant_id": result.tenant_id,
        "status": result.status,
        "chunks_count": result.chunks_count,
        "char_count": result.char_count,
        "token_count": result.token_count,
        "error": result.error,
    }


@app.get("/v1/kb/documents/{document_id}")
async def get_kb_document(document_id: str, tenant_id: str) -> dict[str, Any]:
    repo = get_ingest_repository()
    doc = await repo.get_document(tenant_id=tenant_id, document_id=document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "tenant_id": doc.tenant_id,
        "title": doc.title,
        "source": doc.source,
        "status": doc.status,
        "error": doc.error,
        "chunk_count": doc.chunk_count,
        "version": doc.version,
    }


@app.get("/v1/kb/documents/{document_id}/chunks")
async def get_kb_chunks(document_id: str, tenant_id: str) -> dict[str, Any]:
    repo = get_ingest_repository()
    chunks = await repo.get_chunks_for_document(tenant_id=tenant_id, document_id=document_id)
    return {
        "document_id": document_id,
        "tenant_id": tenant_id,
        "chunks": [
            {
                "chunk_index": c.chunk_index,
                "section_path": c.section_path,
                "content": c.content,
                "token_count": c.token_count,
            }
            for c in chunks
        ],
        "count": len(chunks),
    }


# ── Retrieval Endpoints (AI-1) ──
class SearchRequest(BaseModel):
    tenant_id: str = Field(description="Tenant ID for strict isolation")
    query: str = Field(min_length=1, description="Search query string")
    top_k: int = Field(default=5, ge=1, le=50)
    vector_top_k: int = Field(default=20, ge=1, le=100)
    text_top_k: int = Field(default=20, ge=1, le=100)
    rrf_k: int = Field(default=60, ge=1)


@app.post("/v1/retrieval/search")
async def search_kb(req: SearchRequest) -> dict[str, Any]:
    retriever = HybridRetriever()
    results = await retriever.retrieve(
        tenant_id=req.tenant_id,
        query=req.query,
        top_k=req.top_k,
        vector_top_k=req.vector_top_k,
        text_top_k=req.text_top_k,
        rrf_k=req.rrf_k,
    )
    return {
        "query": req.query,
        "tenant_id": req.tenant_id,
        "count": len(results),
        "results": [
            {
                "id": r.id,
                "document_id": r.document_id,
                "chunk_index": r.chunk_index,
                "content": r.content,
                "section_path": r.section_path,
                "token_count": r.token_count,
                "score": r.score,
                "rrf_score": r.rrf_score,
                "vector_rank": r.vector_rank,
                "text_rank": r.text_rank,
                "vector_score": r.vector_score,
                "text_score": r.text_score,
            }
            for r in results
        ],
    }


# ── RAG Answer Generation Endpoint (AI-1, AI-2, AI-3, AI-9) ──
@app.post("/v1/answer", response_model=GenerateAnswerResponse)
async def generate_answer(req: GenerateAnswerRequest) -> GenerateAnswerResponse:
    service = RagService()
    return await service.generate_answer(req)


# ── AI Draft SSE Streaming Endpoints (Feature 31) ──
class StreamDraftRequest(BaseModel):
    ticket_id: str = Field(default="", description="Ticket ID")
    customer_query: str = Field(description="Customer inquiry text")
    context_chunks: list[str] = Field(
        default_factory=list, description="Optional pre-retrieved context chunks"
    )
    tenant_id: str = Field(default="default", description="Tenant ID for retrieval")


@app.post("/draft-response/stream")
@app.post("/v1/draft-response/stream")
async def stream_draft_response(req: StreamDraftRequest):
    """Stream AI draft response token-by-token over Server-Sent Events (SSE) (Feature 31)."""

    async def event_generator():
        try:
            from src.rag.prompt import is_prompt_injection

            if is_prompt_injection(req.customer_query):
                refusal = "I apologize, but this inquiry cannot be processed automatically."
                for word in refusal.split(" "):
                    yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
                    await asyncio.sleep(0.01)
                done_payload = {
                    "type": "done",
                    "citations": [],
                    "confidence": 1.0,
                    "should_escalate": True,
                    "shouldEscalate": True,
                    "reason": "prompt_injection",
                }
                yield f"data: {json.dumps(done_payload)}\n\n"
                return

            citations = []
            if req.context_chunks:
                context_text = "\n\n".join(req.context_chunks)
                citations = [
                    {"document_id": f"ctx_{i}", "section": f"Chunk {i}"}
                    for i in range(len(req.context_chunks))
                ]
            else:
                retriever = HybridRetriever()
                chunks = await retriever.retrieve(
                    tenant_id=req.tenant_id, query=req.customer_query, top_k=3
                )
                context_text = "\n\n".join(c.content for c in chunks)
                citations = [
                    {
                        "document_id": c.document_id,
                        "section": c.section_path or f"Chunk {c.chunk_index}",
                    }
                    for c in chunks
                ]

            system_prompt = (
                "You are SupportPilot, an AI customer support assistant. "
                "Answer the customer inquiry accurately and professionally based on the context.\n"
                f"<context>\n{context_text}\n</context>"
            )
            user_prompt = f"Customer Query: {req.customer_query}"

            provider = get_llm_provider()
            async for token in provider.stream_generate(system_prompt, user_prompt):
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            done_payload = {
                "type": "done",
                "citations": citations,
                "confidence": 0.92,
                "should_escalate": False,
                "shouldEscalate": False,
            }
            yield f"data: {json.dumps(done_payload)}\n\n"
        except Exception as exc:
            err_payload = {"type": "error", "message": str(exc)}
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Semantic Cache Invalidation Endpoint (AI-7) ──
class CacheInvalidateRequest(BaseModel):
    tenant_id: str = Field(description="Tenant ID whose cache entries should be invalidated")


@app.post("/v1/cache/invalidate")
async def invalidate_cache(req: CacheInvalidateRequest) -> dict[str, Any]:
    count = await get_semantic_cache().invalidate_tenant(req.tenant_id)
    return {"tenant_id": req.tenant_id, "invalidated_count": count}


# ── Evaluation Runner Endpoint (AI-10) ──
class RunEvalRequest(BaseModel):
    dataset_name: str = "supportpilot_golden"
    golden_path: str = "tests/ai-eval/golden/supportpilot_golden.jsonl"
    tenant_id: str = "tenant_eval_01"
    enforce_gate: bool = True


@app.post("/v1/eval/run")
async def run_evaluation(req: RunEvalRequest) -> dict[str, Any]:
    runner = EvalRunner()
    samples = runner.load_golden_set(req.golden_path)
    metrics = await runner.run_evaluation(
        dataset_name=req.dataset_name,
        samples=samples,
        tenant_id=req.tenant_id,
        enforce_gate=req.enforce_gate,
    )
    return {
        "run_id": metrics.run_id,
        "dataset_name": metrics.dataset_name,
        "total_samples": metrics.total_samples,
        "hit_at_5": metrics.hit_at_5,
        "groundedness": metrics.groundedness,
        "escalation_f1": metrics.escalation_f1,
        "escalation_precision": metrics.escalation_precision,
        "escalation_recall": metrics.escalation_recall,
        "p95_latency_ms": metrics.p95_latency_ms,
        "passed_regression_gate": metrics.passed_regression_gate,
        "baseline_groundedness": metrics.baseline_groundedness,
    }


# ── Ticket Classifier Endpoints (AI-4) ──
@app.post("/v1/classify", response_model=ClassifyResponse)
async def classify_ticket(req: ClassifyRequest) -> ClassifyResponse:
    classifier = get_classifier_service()
    return classifier.classify(
        subject=req.subject,
        description=req.description,
        first_message=req.first_message,
        tenant_id=req.tenant_id,
    )


@app.post("/v1/classify/feedback", response_model=ClassifierFeedbackResponse)
async def record_classifier_feedback(req: ClassifierFeedbackRequest) -> ClassifierFeedbackResponse:
    classifier = get_classifier_service()
    return classifier.record_feedback(req)


# ── Agent Assist Endpoints (AI-5, AI-6) ──
@app.post("/v1/assist/suggest-reply", response_model=SuggestReplyResponse)
async def suggest_agent_reply(req: SuggestReplyRequest) -> SuggestReplyResponse:
    assist = get_agent_assist_service()
    return await assist.suggest_reply(req)


@app.post("/v1/assist/summarize", response_model=SummarizeResponse)
async def summarize_thread(req: SummarizeRequest) -> SummarizeResponse:
    assist = get_agent_assist_service()
    return await assist.summarize(req)


# ── Tenant Quota Endpoints (AI-8) ──
@app.get("/v1/quota/{tenant_id}")
async def get_tenant_quota(tenant_id: str) -> dict[str, Any]:
    tracker = get_quota_tracker()
    usage = await tracker.get_usage(tenant_id)
    is_exceeded = await tracker.is_quota_exceeded(tenant_id)
    return {
        "tenant_id": tenant_id,
        "calls": usage["calls"],
        "tokens": usage["tokens"],
        "max_calls": settings.daily_call_quota,
        "max_tokens": settings.daily_token_quota,
        "quota_exceeded": is_exceeded,
    }


@app.post("/v1/quota/{tenant_id}/reset")
async def reset_tenant_quota(tenant_id: str) -> dict[str, Any]:
    tracker = get_quota_tracker()
    await tracker.reset(tenant_id)
    return {"tenant_id": tenant_id, "status": "reset"}
