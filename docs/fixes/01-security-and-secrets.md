# 01 Security and Secrets

## Findings being fixed

1. `scripts/seed.ts#L12` contains a live DigitalOcean Redis URI with a password.
2. `infra/k8s/base/secret.yaml` has plaintext development secrets committed.
3. `pnpm audit`: 65 vulnerabilities (5 critical: `tar`, `cross-spawn`; 25 high).
4. Health/readiness endpoints disclose dependency status without filtering.
5. Ticket number counter relies only on Redis `INCR` (no DB fallback).

## Step 1: Rotate first (before touching git)

Assume the password is already public if the repo was ever public or shared.

1. DigitalOcean console: Databases -> your Redis cluster -> reset the default user's password (or delete the cluster if unused).
2. Check other places the same password was reused and change them.
3. Save a note in `evidence/security/rotation.md`: date, what was rotated (no secret values).

## Step 2: Remove the secret from the code

```ts
// scripts/seed.ts
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL is required');
```

Add `REDIS_URL` to `.env.example` as `REDIS_URL=redis://localhost:6379`.

## Step 3: Purge it from git history

```powershell
pip install git-filter-repo
# 1. Make a backup copy of the whole folder first.
# 2. Create replacements.txt (outside the repo) with a line:  <the-old-password-or-full-uri>==>REDACTED
git filter-repo --replace-text ..\replacements.txt
git remote add origin <your-repo-url>      # filter-repo removes remotes
git push --force --all
git push --force --tags
```

Notes: rotation is what actually protects you; history rewriting only reduces exposure. If the repo was public, also ask GitHub support to purge cached views. Tell any collaborators to re-clone.

## Step 4: Prevent recurrence

- Add gitleaks: pre-commit hook (`.husky/pre-commit`: `gitleaks protect --staged`) and a CI job (`gitleaks detect --redact`). Install via the project's release binary or a package manager available on your system.
- Add `evidence/` and `.env*` rules to `.gitignore` as appropriate (commit evidence text files, not secrets).

## Step 5: Kubernetes secrets

1. Delete `infra/k8s/base/secret.yaml` from git. Add `infra/k8s/base/secret.example.yaml` with placeholder values (`CHANGE_ME`).
2. Document creation:

```powershell
kubectl create secret generic supportpilot-secrets `
  --from-literal=JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") `
  --from-literal=INTERNAL_SERVICE_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

3. Stretch: SOPS or Sealed Secrets, documented in an ADR.
4. App startup must refuse default or short secrets when `NODE_ENV=production` (Zod check: min length 32, not equal to known dev strings).

## Step 6: Dependency vulnerabilities

```powershell
pnpm audit --prod
pnpm update --latest tar cross-spawn
```

If a vulnerable package is transitive, add to root `package.json`:

```json
"pnpm": { "overrides": { "tar": ">=7.4.3", "cross-spawn": ">=7.0.5" } }
```

Then `pnpm install`, rebuild, run all tests. Repeat until `pnpm audit --prod --audit-level=high` is clean. For anything left, write `docs/SECURITY-EXCEPTIONS.md` (package, advisory, why not exploitable, review date). Add to CI: `pnpm audit --prod --audit-level=high`. Python: `pip install pip-audit` and run `pip-audit` in `apps/ai-service`. Also enable Dependabot (`.github/dependabot.yml`) for npm, pip, docker and github-actions.

## Step 7: Health endpoint hardening

- `/health` (liveness): return only `{ "status": "ok" }`.
- `/health/readiness`: return 200 or 503 with `{ "status": "ready" | "not_ready" }`; detailed per-dependency info only behind the internal service token header or on an internal port.
- Test: unauthenticated readiness response contains no dependency names.

## Step 8: Ticket counter resilience

On service start and when `seq:{tenantId}:ticket` is missing, set it to `max(ticketNumber)` from MongoDB using `SET ... NX`; keep the unique index `(tenantId, ticketNumber)` as the final guard and retry on duplicate key error. Test: delete the Redis key, create tickets, assert no duplicate numbers.

## Acceptance checklist

- [ ] Redis password rotated; note saved.
- [ ] No secret in HEAD or history (`gitleaks detect` clean; save output to `evidence/security/gitleaks.txt`).
- [ ] K8s secret is an example only; prod startup rejects dev secrets (tested).
- [ ] `pnpm audit --prod --audit-level=high` clean or exceptions documented; output saved to `evidence/security/audit-after.txt` (and before-state kept).
- [ ] `pip-audit` output saved.
- [ ] Health endpoints minimal; counter reconciliation test passes.

## Resume gating

You may claim: "enforced secret scanning (gitleaks) and dependency audits in CI". You may not claim anything about security scanning until the CI job exists and has run.
