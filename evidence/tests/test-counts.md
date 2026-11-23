# SupportPilot Test Counts

_Generated: 2026-11-23T05:20:51.946Z_
_Integrity Policy: Strict Runner Separation — Zero static fakes, no Newman assertions in test totals, no browser multipliers_

## 1. Automated Test Suites Summary (Discrete Tests by Tool)

| Test Suite / Tool                                    | Framework           | Suites  | Total Tests | Passed  | Failed | Skipped |  Status  |
| ---------------------------------------------------- | ------------------- | :-----: | :---------: | :-----: | :----: | :-----: | :------: |
| Vitest (TypeScript Services)                         | Vitest              |   262   |     568     |   568   |   0    |    0    |   PASS   |
| Pytest (AI Service)                                  | Pytest              |   13    |     90      |   89    |   0    |    1    |   PASS   |
| **Unit and integration (Vitest + pytest)**           | **Vitest + Pytest** | **275** |   **658**   | **657** | **0**  |  **1**  | **PASS** |
| Playwright (Mocked E2E)                              | Playwright          |    8    |     21      |   21    |   0    |    0    |   PASS   |
| Playwright (Live E2E)                                | Playwright          |    6    |      7      |    7    |   0    |    0    |   PASS   |
| Cypress (Role & Security E2E)                        | Cypress             |    3    |     14      |   14    |   0    |    0    |   PASS   |
| **Total Automated Tests (E2E + Unit + Integration)** | **All Runners**     | **292** |   **700**   | **699** | **0**  |  **1**  | **PASS** |

## 2. Vitest Package Breakdown (TypeScript)

| Package / Directory         | Framework  | Test Suites | Total Tests | Passed  | Failed | Skipped |  Status  |
| --------------------------- | ---------- | :---------: | :---------: | :-----: | :----: | :-----: | :------: |
| `packages/validators`       | Vitest     |     43      |     99      |   99    |   0    |    0    |   PASS   |
| `packages/shared-lib`       | Vitest     |     19      |     41      |   41    |   0    |    0    |   PASS   |
| `packages/queue`            | Vitest     |      2      |      7      |    7    |   0    |    0    |   PASS   |
| `apps/gateway`              | Vitest     |     22      |     53      |   53    |   0    |    0    |   PASS   |
| `apps/ticket-service`       | Vitest     |     104     |     245     |   245   |   0    |    0    |   PASS   |
| `apps/notification-service` | Vitest     |     22      |     34      |   34    |   0    |    0    |   PASS   |
| `apps/web`                  | Vitest     |     42      |     80      |   80    |   0    |    0    |   PASS   |
| `apps/widget`               | Vitest     |      8      |      9      |    9    |   0    |    0    |   PASS   |
| **Vitest Subtotal**         | **Vitest** |   **262**   |   **568**   | **568** | **0**  |  **0**  | **PASS** |

## 3. Contract & Benchmark Suites (Excluded from Discrete Test Totals)

| Suite / Tool             | Target Scope                | Volume / Requests |           Outcomes & Assertions           | Status |
| ------------------------ | --------------------------- | :---------------: | :---------------------------------------: | :----: |
| Newman (Postman)         | Gateway REST API Contract   |    46 requests    |         73 assertions (0 failed)          |  PASS  |
| k6 (Load Benchmark)      | Load & Latency Verification |  21186 requests   | 0 checks passed (0 failed, p95: 127.56ms) |  PASS  |
| k6 (Spike Benchmark)     | Load & Latency Verification |  20454 requests   | 0 checks passed (0 failed, p95: 739.17ms) |  FAIL  |
| k6 (WebSocket Benchmark) | Load & Latency Verification |    1 requests     | 0 checks passed (0 failed, p95: 91.91ms)  |  PASS  |
