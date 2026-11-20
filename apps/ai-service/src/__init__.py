"""SupportPilot AI Service — FastAPI entry point."""

from fastapi import FastAPI
from .config import settings

app = FastAPI(
    title="SupportPilot AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}


@app.get("/ready")
async def ready():
    # TODO: check Postgres + Redis connections
    return {"status": "ready"}
