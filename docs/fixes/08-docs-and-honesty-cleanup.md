# 08 Docs and Honesty Cleanup

## Findings being fixed

README port mismatch (4003 vs 5001), docs claim sentence-transformers, queue names differ, roadmap claims Cypress in CI, six "sprint retrospectives" for a ~27 hour build, no CHANGELOG, LOC inflated by generated files.

## Step 1: Make docs match code (do after files 01-07)

- README: ports (notification 5001), start commands, real quick start tested from a clean clone (time it). Add "Known limitations".
- `docs/02-architecture-spec.md`: embedding provider text; queue names `email`, `push`, `webhook`, `sla`, `audit`, `dlq`.
- `docs/04-api-contracts.md`: regenerate from code or OpenAPI (add `swagger-jsdoc` or `zod-to-openapi` for REST; FastAPI already serves `/openapi.json`). Export to `docs/api/`.
- Roadmap checkboxes: only tick what has evidence.

## Step 2: Relabel the history truthfully

The git history shows the build happened over about 27 hours. Do not present it as eight weeks of two-week sprints.

- Rename `RETROSPECTIVE-S1..S6.md` to `docs/iterations/ITERATION-1..6.md` and retitle them "Build iteration N" with the real dates from `git log`, or delete them.
- In README and resumes use "built in iterations", not "sprints", unless you actually timeboxed work with a plan.
- Add `docs/AI-ASSISTED-DEVELOPMENT.md`: which AI tools were used, how (scaffolding, tests, docs), what you wrote or reviewed yourself, how you verified output. Honest, short, interview-ready. Reviewers respect this far more than discovering it.

## Step 4: Changelog, ADRs, templates

- Generate `CHANGELOG.md` with `conventional-changelog` or `git-cliff` from the commit history (v1.0.0 and onwards).
- Add ADRs for: real embeddings and HNSW (file 04), streaming and cache-driven UI (file 05), secrets handling (file 01), Lambda/SQS transport choice (file 07), kind for Kubernetes (file 02).
- Keep PR and issue templates; add a `SECURITY.md` with reporting instructions.

## Step 5: Repo hygiene

- Exclude generated artefacts from the repo and LOC: `coverage/`, `playwright-report/`, `test-results/`, build output. Commit one demo video or GIF deliberately in `docs/demo/` instead of test-run videos.
- Add screenshots to README (inbox, ticket detail, widget, KB test console, mobile).
- Add badges: CI status, license. Add `LICENSE`.
- Pin Node and Python versions (`.nvmrc`, `.python-version`).

## Step 6: Interview walkthrough (important for an AI-assisted codebase)

Create `docs/INTERVIEW-WALKTHROUGH.md`. For each topic write a 60-second explanation in your own words plus the file and function to open. You must be able to do this without notes.

1. Tenant isolation: `BaseTenantRepository.scopeFilter`; the three intentional unscoped queries and why.
2. Auth: access vs refresh tokens, rotation, reuse detection, Redis key `rt:{userId}:{tokenId}`, logout.
3. RBAC middleware and the permission matrix.
4. Optimistic concurrency with `version` and the 409 path.
5. Ticket numbering with Redis `INCR`, the DB unique index and recovery.
6. SLA worker: how deadlines are computed, delayed jobs, breach flagging.
7. BullMQ retries, backoff, DLQ, idempotency.
8. Socket.IO rooms, Redis adapter, reconnect replay.
9. GraphQL: DataLoader batching, depth and complexity limits, subscriptions.
10. Hybrid retrieval: the RRF SQL, why k=60, tenant filter, HNSW vs IVFFlat.
11. RAG guardrails: JSON validation and repair, citation verification, confidence formula, escalation, injection patterns and their limits.
12. Classifier: dataset construction, why TF-IDF + LinearSVC, metrics, fallback, what the 600-sample limitation means.
13. Magic-byte upload validation.
14. Kubernetes: probes, HPA, NetworkPolicy, why kind.
15. What you would change for real production on AWS.
    Also write "Top 5 weaknesses I know about and how I would fix them".

## Acceptance checklist

- [ ] README and docs match the running system (verified by a clean-clone quickstart).
- [ ] No "sprint" or week claims that the git history contradicts.
- [ ] `AI-ASSISTED-DEVELOPMENT.md`, CHANGELOG, SECURITY, LICENSE present.
- [ ] Walkthrough completed and rehearsed out loud.
