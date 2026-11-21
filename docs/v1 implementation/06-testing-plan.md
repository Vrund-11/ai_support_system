# Testing Plan

## Strategy

Test pyramid with real datastores via Testcontainers for integration. Mock LLM in CI. Every FR id maps to at least one test id in the traceability matrix below.

## Tooling

| Layer                | Tool                       | Location                   |
| -------------------- | -------------------------- | -------------------------- |
| Unit (Node)          | Vitest or Jest             | `apps/*/src/**/*.test.ts`  |
| Unit (Python)        | pytest                     | `apps/ai-service/tests`    |
| Property-based       | fast-check                 | beside unit tests          |
| Integration          | Supertest + Testcontainers | `apps/*/tests/integration` |
| API regression       | Postman + Newman           | `tests/api`                |
| Web E2E              | Cypress (agent flows)      | `tests/e2e/cypress`        |
| Widget/cross-browser | Playwright                 | `tests/e2e/playwright`     |
| Performance          | k6                         | `tests/perf`               |
| AI eval              | custom runner              | `tests/ai-eval`            |
| Mobile               | Jest + RN Testing Library  | `apps/mobile/__tests__`    |

## Coverage and gates

Target 80% lines for services; CI fails below 70%. Required checks on main: lint, type-check, unit, integration, e2e (smoke), Trivy, ai-eval (when ai-service changes).

## Critical test cases

| ID         | Scenario                                                                     | Type            |
| ---------- | ---------------------------------------------------------------------------- | --------------- |
| T-TEN-01   | Tenant A cannot read/update/delete tenant B ticket via REST, GraphQL, socket | integration     |
| T-TEN-02   | Vector search never returns another tenant's chunks                          | integration     |
| T-AUTH-01  | Refresh token rotation; reuse of old token revokes session                   | integration     |
| T-AUTH-02  | Login throttling after 5 failures; backoff increases                         | integration     |
| T-AUTH-03  | RBAC matrix: each role vs each route returns expected status                 | integration     |
| T-TKT-01   | Invalid transition rejected; valid writes event                              | unit + property |
| T-TKT-02   | Concurrent updates with same version: one 200, one 409                       | integration     |
| T-TKT-03   | Idempotency-Key duplicate create returns same ticket                         | integration     |
| T-CHAT-01  | Reconnect replays missed messages in order, no duplicates                    | integration     |
| T-CHAT-02  | Low-confidence answer escalates once and creates one ticket                  | integration     |
| T-AI-01    | Invalid LLM JSON repaired once, then escalated                               | unit            |
| T-AI-02    | Citation not in retrieved set rejects answer                                 | unit            |
| T-AI-03    | Prompt-injection text in a KB doc does not alter behaviour                   | eval            |
| T-SLA-01   | Warning at 75%, breach at 100%, none if resolved early                       | unit            |
| T-FILE-01  | Spoofed extension rejected (magic bytes)                                     | integration     |
| T-NOTIF-01 | Failed push retried with backoff then DLQ                                    | integration     |
| T-HOOK-01  | Webhook signature verifies; retries on 500                                   | integration     |
| T-SEC-01   | Security headers, CORS allow-list, oversized body rejected                   | integration     |

## Traceability matrix (fill as built)

| FR id      | Test ids                   | Status |
| ---------- | -------------------------- | ------ |
| AUTH-1..7  | T-AUTH-01..03              |        |
| TEN-1..5   | T-TEN-01,02                |        |
| TKT-1..10  | T-TKT-01..03               |        |
| CHAT-1..7  | T-CHAT-01,02               |        |
| KB-1..6    | T-FILE-01, ingestion tests |        |
| AI-1..10   | T-AI-01..03, eval          |        |
| AUTO-1..5  | T-SLA-01                   |        |
| NOTIF-1..5 | T-NOTIF-01                 |        |
| INT-1..3   | T-HOOK-01                  |        |

## k6 thresholds

```js
export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 200 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:tickets_list}': ['p(95)<400'],
    ws_msg_latency: ['p(95)<300'],
  },
};
```

## Manual QA checklist per release

Smoke: sign up, login, create ticket, reply, widget chat, escalation, KB upload, push notification on device, logout. Exploratory: 30-minute session per sprint, bugs logged with steps, expected, actual, severity, logs.

## Bug template

Title, environment, steps, expected, actual, severity (S1-S4), screenshots or trace, related FR/test id.
