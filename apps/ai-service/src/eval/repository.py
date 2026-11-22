"""Repository for storing and querying AI evaluation runs (ai_eval_runs) (AI-10)."""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import psycopg

from src.config import settings


@dataclass
class EvalRunRecord:
    id: str
    dataset_name: str
    total_samples: int
    hit_at_5: float
    groundedness: float
    escalation_f1: float
    escalation_precision: float
    escalation_recall: float
    p95_latency_ms: float
    passed_regression_gate: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    hit_at_1: float = 0.0
    mrr: float = 0.0
    p50_latency_ms: float = 0.0
    commit_sha: str = ""
    embedding_model: str = ""
    llm_model: str = ""
    dataset_version: str = "v2"


class BaseEvalRepository(ABC):
    """Abstract interface for storing evaluation runs."""

    @abstractmethod
    async def save_run(self, record: EvalRunRecord) -> str:
        raise NotImplementedError

    @abstractmethod
    async def get_latest_baseline(self, dataset_name: str) -> EvalRunRecord | None:
        raise NotImplementedError

    @abstractmethod
    async def list_runs(self, limit: int = 10) -> list[EvalRunRecord]:
        raise NotImplementedError


class MemoryEvalRepository(BaseEvalRepository):
    """Hermetic in-memory evaluation repository for tests and local runs."""

    def __init__(self) -> None:
        self.runs: list[EvalRunRecord] = []

    async def save_run(self, record: EvalRunRecord) -> str:
        self.runs.append(record)
        return record.id

    async def get_latest_baseline(self, dataset_name: str) -> EvalRunRecord | None:
        matching = [r for r in self.runs if r.dataset_name == dataset_name]
        return matching[-1] if matching else None

    async def list_runs(self, limit: int = 10) -> list[EvalRunRecord]:
        return list(reversed(self.runs))[:limit]


class PostgresEvalRepository(BaseEvalRepository):
    """PostgreSQL repository storing evaluation history in ai_eval_runs table."""

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn or settings.database_url

    async def init_schema(self) -> None:
        """Create ai_eval_runs table if not exists."""
        conn = await psycopg.AsyncConnection.connect(self.dsn)
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_eval_runs (
                    id TEXT PRIMARY KEY,
                    dataset_name TEXT NOT NULL,
                    total_samples INT NOT NULL,
                    hit_at_5 FLOAT NOT NULL,
                    groundedness FLOAT NOT NULL,
                    escalation_f1 FLOAT NOT NULL,
                    escalation_precision FLOAT NOT NULL,
                    escalation_recall FLOAT NOT NULL,
                    p95_latency_ms FLOAT NOT NULL,
                    passed_regression_gate BOOLEAN NOT NULL DEFAULT TRUE,
                    metadata JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS idx_eval_runs_dataset
                    ON ai_eval_runs(dataset_name, created_at DESC);
                """
            )
            await conn.commit()

    async def save_run(self, record: EvalRunRecord) -> str:
        conn = await psycopg.AsyncConnection.connect(self.dsn)
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO ai_eval_runs (
                    id, dataset_name, total_samples, hit_at_5, groundedness,
                    escalation_f1, escalation_precision, escalation_recall,
                    p95_latency_ms, passed_regression_gate, metadata, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    dataset_name = EXCLUDED.dataset_name,
                    total_samples = EXCLUDED.total_samples,
                    hit_at_5 = EXCLUDED.hit_at_5,
                    groundedness = EXCLUDED.groundedness,
                    escalation_f1 = EXCLUDED.escalation_f1,
                    escalation_precision = EXCLUDED.escalation_precision,
                    escalation_recall = EXCLUDED.escalation_recall,
                    p95_latency_ms = EXCLUDED.p95_latency_ms,
                    passed_regression_gate = EXCLUDED.passed_regression_gate,
                    metadata = EXCLUDED.metadata,
                    created_at = EXCLUDED.created_at;
                """,
                (
                    record.id,
                    record.dataset_name,
                    record.total_samples,
                    record.hit_at_5,
                    record.groundedness,
                    record.escalation_f1,
                    record.escalation_precision,
                    record.escalation_recall,
                    record.p95_latency_ms,
                    record.passed_regression_gate,
                    json.dumps(record.metadata),
                    record.created_at,
                ),
            )
            await conn.commit()
            return record.id

    async def get_latest_baseline(self, dataset_name: str) -> EvalRunRecord | None:
        conn = await psycopg.AsyncConnection.connect(self.dsn)
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, dataset_name, total_samples, hit_at_5, groundedness,
                       escalation_f1, escalation_precision, escalation_recall,
                       p95_latency_ms, passed_regression_gate, metadata, created_at
                FROM ai_eval_runs
                WHERE dataset_name = %s
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                (dataset_name,),
            )
            row = await cur.fetchone()
            if not row:
                return None
            return EvalRunRecord(
                id=str(row[0]),
                dataset_name=str(row[1]),
                total_samples=int(row[2]),
                hit_at_5=float(row[3]),
                groundedness=float(row[4]),
                escalation_f1=float(row[5]),
                escalation_precision=float(row[6]),
                escalation_recall=float(row[7]),
                p95_latency_ms=float(row[8]),
                passed_regression_gate=bool(row[9]),
                metadata=dict(row[10]) if isinstance(row[10], dict) else {},
                created_at=row[11],
            )

    async def list_runs(self, limit: int = 10) -> list[EvalRunRecord]:
        conn = await psycopg.AsyncConnection.connect(self.dsn)
        async with conn, conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, dataset_name, total_samples, hit_at_5, groundedness,
                       escalation_f1, escalation_precision, escalation_recall,
                       p95_latency_ms, passed_regression_gate, metadata, created_at
                FROM ai_eval_runs
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (limit,),
            )
            rows = await cur.fetchall()
            return [
                EvalRunRecord(
                    id=str(r[0]),
                    dataset_name=str(r[1]),
                    total_samples=int(r[2]),
                    hit_at_5=float(r[3]),
                    groundedness=float(r[4]),
                    escalation_f1=float(r[5]),
                    escalation_precision=float(r[6]),
                    escalation_recall=float(r[7]),
                    p95_latency_ms=float(r[8]),
                    passed_regression_gate=bool(r[9]),
                    metadata=dict(r[10]) if isinstance(r[10], dict) else {},
                    created_at=r[11],
                )
                for r in rows
            ]


_active_eval_repo: BaseEvalRepository = MemoryEvalRepository()


def get_eval_repository() -> BaseEvalRepository:
    return _active_eval_repo


def set_eval_repository(repo: BaseEvalRepository) -> None:
    global _active_eval_repo
    _active_eval_repo = repo
