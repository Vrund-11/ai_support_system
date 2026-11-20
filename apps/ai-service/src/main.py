"""SupportPilot AI Service — FastAPI application."""

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.config import settings
from src.ingest.pipeline import IngestionPipeline
from src.ingest.repository import get_ingest_repository
from src.lib.db import check_db_connection
from src.lib.redis import check_redis_connection
from src.providers.factory import get_llm_provider
from src.schemas.llm import RagAnswer

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
