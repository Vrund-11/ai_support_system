"""PostgreSQL / pgvector database connection checker."""

import psycopg

from src.config import settings


async def check_db_connection() -> dict[str, str]:
    """Check connectivity to PostgreSQL with pgvector extension."""
    try:
        async with (
            await psycopg.AsyncConnection.connect(
                settings.database_url,
                connect_timeout=2,
            ) as aconn,
            aconn.cursor() as cur,
        ):
            await cur.execute("SELECT 1;")
            await cur.fetchone()
        return {"status": "connected", "database": "postgresql"}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}
