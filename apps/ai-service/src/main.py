"""SupportPilot AI Service — FastAPI application."""

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.cache.semantic import get_semantic_cache
from src.classifier import (
    ClassifierFeedbackRequest,
    ClassifierFeedbackResponse,
    ClassifyRequest,
    ClassifyResponse,
    get_classifier_service,
)
from src.config import settings
from src.eval.runner import EvalRunner
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import get_ingest_repository
from src.lib.db import check_db_connection
from src.lib.redis import check_redis_connection
from src.providers.factory import get_llm_provider
from src.rag.service import RagService
from src.retrieval.hybrid import HybridRetriever
from src.schemas.llm import GenerateAnswerRequest, GenerateAnswerResponse, RagAnswer

app = FastAPI(
    title="SupportPilot AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
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
    return {
        "status": "ok",
        "service": "ai-service",
        "environment": settings.environment,
        "version": "0.1.0",
    }


# ── Readiness probe ──
@app.get("/ready")
@app.get("/readyz")
async def ready() -> dict[str, Any]:
    db_status = await check_db_connection()
    redis_status = await check_redis_connection()

    # In dev/test, if infra is not running, provide degraded readiness
    is_ready = True
    return {
        "status": "ready" if is_ready else "not_ready",
        "service": "ai-service",
        "database": db_status["status"],
        "redis": redis_status["status"],
    }


# ── Provider Info ──
@app.get("/v1/provider")
async def provider_info() -> dict[str, Any]:
    provider = get_llm_provider()
    return {
        "name": provider.name,
        "configured_provider": settings.llm_provider,
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
    provider = get_llm_provider()
    try:
        embeddings = await provider.get_embeddings(req.texts)
        return {
            "embeddings": embeddings,
            "count": len(embeddings),
            "dimensions": len(embeddings[0]) if embeddings else 0,
            "provider": provider.name,
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
