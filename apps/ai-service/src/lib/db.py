"""PostgreSQL / pgvector database connection checker."""

import asyncio

import psycopg

from src.config import settings


def _sync_check() -> None:
    try:
        with (
            psycopg.connect(settings.database_url, connect_timeout=2) as conn,
            conn.cursor() as cur,
        ):
            cur.execute("SELECT 1;")
            cur.fetchone()
    except Exception:
        if ":5432" in settings.database_url:
            alt_url = settings.database_url.replace(":5432", ":5433")
            with (
                psycopg.connect(alt_url, connect_timeout=2) as conn,
                conn.cursor() as cur,
            ):
                cur.execute("SELECT 1;")
                cur.fetchone()
        else:
            raise


async def check_db_connection() -> dict[str, str]:
    """Check connectivity to PostgreSQL with pgvector extension."""
    try:
        await asyncio.to_thread(_sync_check)
        return {"status": "connected", "database": "postgresql"}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}
