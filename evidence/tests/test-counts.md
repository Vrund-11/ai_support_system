# SupportPilot Test Counts

_Generated: 2026-11-22T11:53:59.290Z_
_Integrity Mode: Strict — Unit/Integration tests separated from E2E/API assertions_

## Unit & Integration Test Suites

| Package / Directory                | Framework  | Test Suites | Total Tests | Passed  | Failed | Skipped |  Status  |
| ---------------------------------- | ---------- | :---------: | :---------: | :-----: | :----: | :-----: | :------: |
| `packages/validators`              | Vitest     |      3      |      8      |    8    |   0    |    0    |   PASS   |
| `packages/shared-lib`              | Vitest     |     19      |     41      |   41    |   0    |    0    |   PASS   |
| `apps/gateway`                     | Vitest     |     22      |     53      |   53    |   0    |    0    |   PASS   |
| `apps/ticket-service`              | Vitest     |     99      |     236     |   236   |   0    |    0    |   PASS   |
| `apps/notification-service`        | Vitest     |     12      |     23      |   23    |   0    |    0    |   PASS   |
| **Subtotal (TypeScript / Vitest)** | **Vitest** |   **155**   |   **361**   | **361** | **0**  |  **0**  | **PASS** |
| `apps/ai-service`                  | Pytest     |     12      |     77      |   77    |   0    |    0    |   PASS   |
| **Subtotal (Python / Pytest)**     | **Pytest** |   **12**    |   **77**    | **77**  | **0**  |  **0**  | **PASS** |
| **TOTAL UNIT & INTEGRATION**       | —          |   **167**   |   **438**   | **438** | **0**  |  **0**  | **PASS** |

## End-to-End, Contract & Benchmark Suites (Reported Separately)

| Suite Classification   | Tool / Engine    | Target Scope                | Discrete Items | Assertions / VUs | Status |
| ---------------------- | ---------------- | --------------------------- | :------------: | :--------------: | :----: |
| API Contract Suite     | Newman (Postman) | Gateway REST Endpoints      |  46 requests   |  73 assertions   |  PASS  |
| Browser E2E Automation | Playwright       | Widget, Dashboard, Realtime |  8 spec files  | 42 passing tests |  PASS  |
| Security & Role E2E    | Cypress          | Admin Cockpit & RBAC Matrix |  3 spec files  |  22 assertions   |  PASS  |
| Load & Spike Benchmark | k6               | Gateway / Ticket Service    |  4 scenarios   |     500 VUs      |  PASS  |
