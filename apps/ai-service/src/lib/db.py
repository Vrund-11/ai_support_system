"""PostgreSQL / pgvector database connection checker."""

import asyncio
import psycopg

from src.config import settings


def _sync_check() -> None:
    with psycopg.connect(settings.database_url, connect_timeout=2) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
            cur.fetchone()


async def check_db_connection() -> dict[str, str]:
    """Check connectivity to PostgreSQL with pgvector extension."""
    try:
        await asyncio.to_thread(_sync_check)
        return {"status": "connected", "database": "postgresql"}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}
