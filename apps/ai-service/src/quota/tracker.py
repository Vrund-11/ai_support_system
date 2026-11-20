"""Tenant call and token quota tracking (AI-8).

Tracks daily usage per tenant using the key format:
    quota:tenant:{tenant_id}:{date}
where date is formatted as YYYY-MM-DD.
"""

import logging
from abc import ABC, abstractmethod
from datetime import UTC, datetime

import redis.asyncio as aioredis

from src.config import settings

logger = logging.getLogger(__name__)


def get_current_date() -> str:
    """Return current UTC date in YYYY-MM-DD format."""
    return datetime.now(UTC).strftime("%Y-%m-%d")


def build_quota_key(tenant_id: str, date: str | None = None) -> str:
    """Construct Redis quota key: quota:tenant:{tenant_id}:{date}."""
    d = date or get_current_date()
    return f"quota:tenant:{tenant_id}:{d}"


class BaseQuotaTracker(ABC):
    """Abstract interface for tenant quota tracking."""

    @abstractmethod
    async def get_usage(self, tenant_id: str, date: str | None = None) -> dict[str, int]:
        """Return {'calls': int, 'tokens': int} for tenant on given date."""
        raise NotImplementedError

    @abstractmethod
    async def increment_usage(
        self,
        tenant_id: str,
        calls: int = 1,
        tokens: int = 0,
        date: str | None = None,
    ) -> dict[str, int]:
        """Increment daily calls and tokens for tenant."""
        raise NotImplementedError

    @abstractmethod
    async def is_quota_exceeded(
        self,
        tenant_id: str,
        date: str | None = None,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> bool:
        """Check if tenant has exceeded daily call or token quota."""
        raise NotImplementedError

    @abstractmethod
    async def set_tenant_limits(
        self,
        tenant_id: str,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> None:
        """Set custom quota limits for a tenant."""
        raise NotImplementedError

    @abstractmethod
    async def reset(self, tenant_id: str, date: str | None = None) -> None:
        """Reset quota counters for tenant on given date."""
        raise NotImplementedError

    @abstractmethod
    async def clear(self) -> None:
        """Clear all quota state (for tests)."""
        raise NotImplementedError


class MemoryQuotaTracker(BaseQuotaTracker):
    """In-memory quota tracker for hermetic unit testing and standalone mode."""

    def __init__(self) -> None:
        # key -> {"calls": int, "tokens": int}
        self._usage: dict[str, dict[str, int]] = {}
        # tenant_id -> {"max_calls": int, "max_tokens": int}
        self._limits: dict[str, dict[str, int]] = {}

    async def get_usage(self, tenant_id: str, date: str | None = None) -> dict[str, int]:
        key = build_quota_key(tenant_id, date)
        entry = self._usage.get(key, {"calls": 0, "tokens": 0})
        return dict(entry)

    async def increment_usage(
        self,
        tenant_id: str,
        calls: int = 1,
        tokens: int = 0,
        date: str | None = None,
    ) -> dict[str, int]:
        key = build_quota_key(tenant_id, date)
        if key not in self._usage:
            self._usage[key] = {"calls": 0, "tokens": 0}
        self._usage[key]["calls"] += calls
        self._usage[key]["tokens"] += tokens
        return dict(self._usage[key])

    async def is_quota_exceeded(
        self,
        tenant_id: str,
        date: str | None = None,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> bool:
        usage = await self.get_usage(tenant_id, date)
        tenant_limit = self._limits.get(tenant_id, {})

        call_limit = (
            max_calls
            if max_calls is not None
            else tenant_limit.get("max_calls", settings.daily_call_quota)
        )
        token_limit = (
            max_tokens
            if max_tokens is not None
            else tenant_limit.get("max_tokens", settings.daily_token_quota)
        )

        return usage["calls"] >= call_limit or usage["tokens"] >= token_limit

    async def set_tenant_limits(
        self,
        tenant_id: str,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> None:
        self._limits[tenant_id] = {
            "max_calls": max_calls if max_calls is not None else settings.daily_call_quota,
            "max_tokens": max_tokens if max_tokens is not None else settings.daily_token_quota,
        }

    async def reset(self, tenant_id: str, date: str | None = None) -> None:
        key = build_quota_key(tenant_id, date)
        if key in self._usage:
            del self._usage[key]

    async def clear(self) -> None:
        self._usage.clear()
        self._limits.clear()


class RedisQuotaTracker(BaseQuotaTracker):
    """Production Redis-backed quota tracker with TTL and atomic HINCRBY."""

    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url or settings.redis_url
        self._client: aioredis.Redis | None = None
        self._limits: dict[str, dict[str, int]] = {}

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self.redis_url, decode_responses=True)
        return self._client

    async def get_usage(self, tenant_id: str, date: str | None = None) -> dict[str, int]:
        key = build_quota_key(tenant_id, date)
        try:
            client = await self._get_client()
            raw = await client.hgetall(key)
            calls = int(raw.get("calls", 0)) if raw else 0
            tokens = int(raw.get("tokens", 0)) if raw else 0
            return {"calls": calls, "tokens": tokens}
        except Exception as exc:
            logger.warning("Redis quota get failed: %s", exc)
            return {"calls": 0, "tokens": 0}

    async def increment_usage(
        self,
        tenant_id: str,
        calls: int = 1,
        tokens: int = 0,
        date: str | None = None,
    ) -> dict[str, int]:
        key = build_quota_key(tenant_id, date)
        try:
            client = await self._get_client()
            async with client.pipeline(transaction=True) as pipe:
                pipe.hincrby(key, "calls", calls)
                pipe.hincrby(key, "tokens", tokens)
                pipe.expire(key, 172800)  # 48 hours TTL
                res = await pipe.execute()
            return {"calls": res[0], "tokens": res[1]}
        except Exception as exc:
            logger.warning("Redis quota increment failed: %s", exc)
            return {"calls": 0, "tokens": 0}

    async def is_quota_exceeded(
        self,
        tenant_id: str,
        date: str | None = None,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> bool:
        usage = await self.get_usage(tenant_id, date)
        tenant_limit = self._limits.get(tenant_id, {})

        call_limit = (
            max_calls
            if max_calls is not None
            else tenant_limit.get("max_calls", settings.daily_call_quota)
        )
        token_limit = (
            max_tokens
            if max_tokens is not None
            else tenant_limit.get("max_tokens", settings.daily_token_quota)
        )

        return usage["calls"] >= call_limit or usage["tokens"] >= token_limit

    async def set_tenant_limits(
        self,
        tenant_id: str,
        max_calls: int | None = None,
        max_tokens: int | None = None,
    ) -> None:
        self._limits[tenant_id] = {
            "max_calls": max_calls if max_calls is not None else settings.daily_call_quota,
            "max_tokens": max_tokens if max_tokens is not None else settings.daily_token_quota,
        }

    async def reset(self, tenant_id: str, date: str | None = None) -> None:
        key = build_quota_key(tenant_id, date)
        try:
            client = await self._get_client()
            await client.delete(key)
        except Exception as exc:
            logger.warning("Redis quota reset failed: %s", exc)

    async def clear(self) -> None:
        try:
            client = await self._get_client()
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor, match="quota:tenant:*", count=50)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as exc:
            logger.warning("Redis quota clear failed: %s", exc)


# Active global quota tracker instance (defaults to MemoryQuotaTracker for tests/dev)
_active_quota_tracker: BaseQuotaTracker = MemoryQuotaTracker()


def get_quota_tracker() -> BaseQuotaTracker:
    """Return active quota tracker singleton."""
    return _active_quota_tracker


def set_quota_tracker(tracker: BaseQuotaTracker) -> None:
    """Override active quota tracker singleton (e.g. for testing)."""
    global _active_quota_tracker
    _active_quota_tracker = tracker
