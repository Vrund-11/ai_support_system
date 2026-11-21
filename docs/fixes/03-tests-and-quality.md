# 03 Tests and Quality

## Findings being fixed

Playwright 3 failures (title mismatch); Cypress and k6 never ran; no Python coverage; "421 tests" was inflated; bench numbers were in-process not k6; endpoint count unverified; LOC count included generated HTML.

## Step 1: Fix Playwright

Failing spec: `tests/e2e/specs/widget.spec.ts:18`. Expected title `/SupportPilot Help/`, received `"SupportPilot - Customer Portal & Help Center"`.
Decide which is correct. If the page title is the intended product copy, update the test to `/SupportPilot/`. Do not weaken other assertions.

```powershell
pnpm exec playwright install --with-deps
pnpm test:playwright
```

Add at least these specs (all browsers or chromium + firefox): login and logout, create ticket from dashboard, widget submits ticket and dashboard sees it, tenant A cannot open tenant B ticket URL (expects 403/404), agent reply appears live in widget (socket), KB upload shows status change. Target: all green; save `playwright-report` summary to `evidence/tests/playwright.txt`.

## Step 2: Run Cypress

```powershell
pnpm exec cypress install
pnpm exec cypress verify
pnpm exec cypress run --config-file tests/e2e/cypress.config.ts
```

Fix specs or selectors. Add Cypress to `e2e.yml` (the roadmap claimed it ran in CI). Save results (spec list, passes) to `evidence/tests/cypress.txt` and keep videos as workflow artifacts.

## Step 3: Real k6 runs

```powershell
k6 version
k6 run tests/k6/load-test.js --summary-export evidence/perf/k6-load-summary.json
k6 run tests/k6/ticket-spike.js --summary-export evidence/perf/k6-spike-summary.json
```

Requirements: stack running via compose or kind; seeded data (`pnpm tsx scripts/seed.ts` against a local Redis/Mongo only); login once in `setup()` and reuse the token; tag requests (`tags: { endpoint: 'tickets_list' }`); thresholds in `options`. Record: VUs, duration, requests per second, `http_req_duration` p95, error rate, machine specs (CPU, RAM, Docker memory limit). Also add a WebSocket scenario using `k6/experimental/websockets` or `k6/ws` to measure message round-trip and concurrent connections; record p95.
Be explicit in notes: "run on a laptop against local containers". Remove `scripts/bench-smoke.js` from claims (keep as a dev tool, labelled).

## Step 4: Coverage everywhere

Vitest:

```powershell
pnpm add -D -w @vitest/coverage-v8
pnpm -r test -- --coverage --coverage.reporter=text-summary --coverage.reporter=json-summary
```

Python:

```powershell
cd apps/ai-service
pip install pytest-cov
pytest --cov=src --cov-report=term-missing --cov-report=xml
```

Add `pytest-cov` to dev requirements. Create `scripts/coverage-table.mjs` that reads every `coverage-summary.json` and `coverage.xml` and prints a per-package table (lines, branches, functions) to `evidence/tests/coverage.md`. Set CI thresholds (lines >= 70). Do not report an "average"; report per package.

## Step 5: Honest test counts

Create `scripts/count-tests.mjs`:

- Vitest: `vitest run --reporter=json --outputFile=evidence/tests/vitest-<pkg>.json` per package, sum `numTotalTests`, `numPassedTests`.
- Pytest: `pytest --junitxml=evidence/tests/pytest.xml`, read counts.
- Playwright, Cypress, Newman: report separately (specs and assertions are not the same as unit tests).
  Output `evidence/tests/test-counts.md` as a table with separate rows. Never add Newman assertions to the unit total. Expected today: 323 Vitest + 74 pytest = 397 unit/integration tests.

## Step 6: Expand Postman/Newman

Collection currently has 11 requests. Grow to 40+ covering auth, tickets CRUD, tenant isolation (use two tenants' tokens), RBAC matrix, rate limit 429, validation errors, webhook signature. Use environments and pre-request scripts for tokens. Run in CI: `newman run ... --reporters cli,junit`. Save output.

## Step 7: Endpoint and LOC counts you can defend

- Endpoint count script `scripts/list-endpoints.mjs`: print every `router.<method>(` and `app.<method>(` with file and line, plus FastAPI decorators; write `evidence/endpoints.md`. Use that total (exclude `/health`, `/metrics` if you say "business endpoints"). Replace "121" everywhere if different.
- LOC: use `tokei` or `scc` if available, or update your script to exclude `coverage`, `test-results`, `playwright-report`, `docs/diagrams`, generated HTML. Report only source languages (TS, TSX, Python).

## Step 8: Missing property and concurrency tests

Verify these exist and pass; add if missing: ticket status transition map (fast-check), version conflict 409, idempotency key duplicate create, reconnect replay without duplicates, SLA warning/breach/none-if-resolved, prompt-injection cases, webhook signature verify.

## Acceptance checklist

- [ ] Playwright: all specs green; Cypress: all specs green; both in CI.
- [ ] k6 load, spike and websocket runs with saved summaries and machine specs.
- [ ] Coverage table for every package including Python; CI thresholds in place.
- [ ] `test-counts.md` with separate rows; no inflated total.
- [ ] Newman 40+ requests, run in CI.
- [ ] `endpoints.md` generated and the README number matches.

## Resume gating

After this file you may claim: "[N] automated tests (Vitest, pytest), [X]% line coverage across [M] packages, Playwright and Cypress E2E in CI, k6 load tests (p95 [Y] ms at [V] VUs on local containers)". Use only values from the evidence files.
