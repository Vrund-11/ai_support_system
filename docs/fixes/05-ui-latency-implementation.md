# 05 UI Latency: Implement and Measure

## Findings being fixed

No optimistic updates, no virtualisation, no prefetching, no streaming AI messages; list indexes not tuned for filters; no timing instrumentation. Reference design: `docs/15-frontend-data-flow-and-latency.md` in the planning pack.

## Step 0: Baseline first (so numbers mean something)

1. Seed 10,000 tickets and 50,000 messages into a local DB (`scripts/seed-large.ts`, local only).
2. Record before-state in `evidence/perf/before.md`:
   - Inbox page: DOM node count (`document.querySelectorAll('*').length`), scripting and rendering time from Chrome DevTools Performance for scroll and filter change, React Profiler commit time.
   - API: `GET /tickets?status=OPEN` p95 with k6; MongoDB `explain("executionStats")` for the exact list query (docsExamined, keysExamined, executionTimeMillis).
   - Lighthouse (Chrome DevTools) for `/inbox` and `/tickets/:id`: LCP, INP, TBT.

## Step 1: Server-side query tuning

- Add compound index matching the common list: `TicketSchema.index({ tenantId: 1, status: 1, priority: 1, updatedAt: -1 })`; also `{ tenantId: 1, assignedAgentId: 1, status: 1, updatedAt: -1 }`. Add `updatedAt` handling in sort. Text index on `title` and `description` for search (or keep regex search disabled).
- Use `.lean()`, field projections for list views, cursor (keyset) pagination on `(updatedAt, _id)`; cap `limit` at 50.
- Re-run `explain()`; record before/after (keys and docs examined, ms). Drop unused indexes after checking `$indexStats`.
- Add `Server-Timing` header middleware (db, cache, total) to gateway and ticket-service; log durations.

## Step 2: Optimistic updates (TanStack Query)

Implement helper `useOptimisticMutation` in `apps/web/src/lib/optimistic.ts`:

```ts
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey });
  const prev = qc.getQueryData(queryKey);
  qc.setQueryData(queryKey, (old) => apply(old, vars));
  return { prev };
},
onError: (_e, _v, ctx) => { qc.setQueryData(queryKey, ctx?.prev); toast.error("Couldn't save. Reverted."); },
onSettled: () => qc.invalidateQueries({ queryKey }),
```

Apply to: send message (use `clientId`), change status, priority, assignee, tags, bulk actions, canned reply insert.
Messages: add `clientId` to the message payload and to `TicketMessage` (index `{tenantId, ticketId, clientId}` unique sparse); server echoes it; client replaces the pending bubble by `clientId` and dedupes socket echoes.
409 handling: on version conflict show "Updated by someone else" with a reload action.
Tests (Vitest + React Testing Library): optimistic render appears before the request resolves; rollback on 500; no duplicate when socket echo arrives; conflict toast.

## Step 3: Virtualisation

```powershell
pnpm --filter @supportpilot/web add @tanstack/react-virtual
```

Virtualise the inbox table and the message thread (reverse scroll anchored to bottom; keep scroll position when older messages load). Fixed or measured row height; keep `aria-rowcount`/`aria-rowindex` for accessibility. Playwright test: with 5,000 rows the DOM contains under ~100 row nodes and scrolling shows later rows.

## Step 4: Prefetch

- Hover or focus on an inbox row: `qc.prefetchQuery({ queryKey: ['ticket', id], queryFn, staleTime: 30_000 })`.
- When scrolled 70% of the loaded pages: prefetch next page.
- Route-level code splitting with `React.lazy`; prefetch the chunk on nav hover with `import('./pages/TicketDetailPage')`.
- Search input debounce 250 ms and cancel in-flight requests with `AbortController`.

## Step 5: Streaming AI drafts end to end

1. ai-service: `POST /draft-response/stream` (see file 04), provider `stream_generate`; mock provider also streams for tests.
2. gateway: `GET/POST /api/v1/ai/draft/stream` proxies the SSE stream with no buffering (`res.flushHeaders()`, disable compression for that route, forward abort).
3. web: use `fetch` with `ReadableStream` (or `@microsoft/fetch-event-source`) in a `useStreamingDraft` hook; append tokens into a memoised `DraftBubble`; show "thinking" within 150 ms; cancel on unmount.
4. Final event carries citations, confidence, shouldEscalate; render citation chips and the escalate hint.
5. Tests: unit test the SSE parser; Playwright test asserting first token arrives before final; abort test.
   Measure: time to first token and time to final, with real provider and with cache hit.

## Step 6: Skeletons, empty and error states audit

Make sure each list and detail view has all three; add tests that force each state.

## Step 7: Budgets and CI

- Add `size-limit` with budgets: web initial JS under 250 KB gzip; route chunks under 100 KB; widget under 80 KB (currently 64-69 KB, keep).
- Lighthouse CI (`@lhci/cli`) in `e2e.yml` for `/login` and `/inbox` with thresholds you actually met on your baseline plus a margin.

## Step 8: After-state measurement

Repeat every baseline measurement and save to `evidence/perf/after.md` plus a comparison table:
| Metric | Before | After |
| Inbox DOM nodes | | |
| Inbox scroll scripting ms | | |
| List query docsExamined / ms | | |
| API p95 (k6) | | |
| Perceived send latency (ms to bubble) | | |
| First AI token (ms) | | |
| Lighthouse LCP / INP | | |

## Acceptance checklist

- [ ] Before and after files exist with real numbers.
- [ ] Optimistic updates with rollback and dedupe, with tests.
- [ ] Virtualised inbox and thread; Playwright DOM-node test.
- [ ] Prefetch on hover and next page; debounce and abort.
- [ ] Streaming drafts working in the UI; abort handled.
- [ ] Compound indexes added; explain before/after recorded; `Server-Timing` present.
- [ ] Bundle and Lighthouse budgets in CI.

## Resume gating

Allowed after measuring: "Cut inbox render cost from [A] to [B] DOM nodes via virtualisation; reduced list query from [X] to [Y] ms with compound indexes; optimistic updates and streamed AI drafts (first token [Z] ms)". Use only the saved numbers.
