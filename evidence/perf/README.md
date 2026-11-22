# Performance Benchmark Evidence Repository (`evidence/perf/`)

## Purpose

This directory houses authentic performance benchmark artifacts generated strictly by `k6` execution against running network-isolated container services, per **ADR-012** and **ORIGINAL_REQUEST.md** Requirement R2.

## Governance Rules

1. **Zero Mock Ingestion**: In-process smoke tests (Vitest `tests/integration/in-process-concurrency.test.ts`) are forbidden from writing to or citing this directory.
2. **Defensible Attribution**: Every file here must be generated directly by `k6 run --summary-export <path>` or database query execution stats (`explain("executionStats")`).
3. **Hardware Traceability**: Every benchmark run must correlate with documented machine specifications in `machine-specs.txt`.

## Artifact Manifest

- `machine-specs.txt`: Hardware and runtime baseline environment specifications.
- `k6-load-summary.json`: Output from `k6 run tests/perf/tickets.js --summary-export evidence/perf/k6-load-summary.json` (Target: 200 concurrent VUs, p95 < 400ms, error rate < 1%).
- `k6-spike-summary.json`: Output from `k6 run tests/perf/ticket-spike.js --summary-export evidence/perf/k6-spike-summary.json` (Target: 500 VUs spike burst, p95 < 400ms, error rate < 1%).
- `k6-ws-summary.json`: Output from `k6 run tests/perf/chat.js --summary-export evidence/perf/k6-ws-summary.json` (Target: 30 concurrent sockets fan-out, p95 < 300ms, checks rate > 99%).
