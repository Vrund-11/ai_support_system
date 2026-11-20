# AGENTS.md: Instructions for any AI agent working on SupportPilot

## Mission

Implement SupportPilot exactly as specified in `docs/PRD.md` and the planning files. The owner is a learner who wants every technology to be genuinely used and understood. Explain non-obvious choices in short comments and in `docs/00-decisions-adr.md`.

## Ground rules

1. **Read before coding:** `docs/11-progress-log.md` (state), then the current sprint in `docs/05-implementation-roadmap.md`.
2. **One task at a time.** Use task ids (for example S1-T04). Finish, test, tick the box, log it.
3. **Never invent measurements.** Metrics, coverage, latency, F1 come only from real runs. Record them in `docs/10-resume-evidence-tracker.md`.
4. **No AWS account exists.** Use the substitutes in `docs/01-free-tools-and-aws-emulation.md`. Use AWS SDK v3 with endpoint overrides so code works unchanged on real AWS.
5. **Tenant isolation is non-negotiable.** Every query includes `tenantId` at the repository layer. Any new data access needs a cross-tenant test.
6. **Tests with features.** A task is not done without tests listed in its acceptance criteria.
7. **No secrets in git.** Use `.env` (gitignored) and `.env.example` (names only).
8. **Small PRs, conventional commits** (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
9. **Ask before large deviations** from the PRD. Record approved changes as a new ADR.

## Conventions

- TypeScript strict everywhere in Node, Python 3.12 with type hints and Ruff.
- Validation with Zod (Node) and Pydantic (Python). Shared schemas in `packages/validators`.
- Errors use RFC 7807 problem-details. Logs are JSON with `requestId`, `tenantId`, `userId`.
- Naming: camelCase JSON, kebab-case files, PascalCase React components.
- Package manager: pnpm workspaces + Turborepo. Node 22. Python via uv or pip with a lockfile.
- Lint and format: ESLint, Prettier, Ruff. Husky pre-commit runs lint-staged.

## Definition of done (every task)

Code + tests passing locally, lint and type-check clean, docs updated if behaviour changed, progress log updated, evidence tracker updated when a measurable result exists.

## Workflow for each session

1. Read the progress log. 2. Pick the next unchecked task. 3. Implement and test. 4. Run `pnpm verify` (lint, type-check, test). 5. Commit. 6. Update the log with: what was done, what is next, blockers, decisions.

## Things an agent must not do

- Do not add dependencies without noting why in the PR description.
- Do not skip failing tests or lower thresholds to pass.
- Do not claim features that are not implemented.
- Do not call real paid APIs from tests; use the mock LLM.
