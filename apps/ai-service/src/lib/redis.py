"""Redis connection checker."""

import redis.asyncio as aioredis

from src.config import settings


async def check_redis_connection() -> dict[str, str]:
    """Check connectivity to Redis instance."""
    try:
        client = aioredis.from_url(settings.redis_url, socket_timeout=2)
        await client.ping()
        await client.aclose()
        return {"status": "connected", "redis": "connected"}
    except Exception as exc:
        return {"status": "disconnected", "error": str(exc)}
