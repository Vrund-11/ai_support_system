# 02 Run the Infrastructure (Docker, Kubernetes, GitHub Actions)

## Findings being fixed

Docker, kubectl, gh were not installed; compose and cluster were never executed; no CI run evidence; `deploy.yml` deploys to a cluster that does not exist.

## Step 1: Tooling (Windows)

1. Install Docker Desktop with the WSL2 backend; confirm `docker version` and `docker compose version`.
2. Install `kubectl`, `kind`, `helm` (optional), GitHub CLI `gh`, `k6` (used in file 03). Use winget, scoop or chocolatey; confirm each with `--version`.
3. Save versions to `evidence/infra/tool-versions.txt`.

## Step 2: Run the local stack

```powershell
docker compose -f infra/docker-compose.infra.yml up -d
docker compose -f infra/docker-compose.infra.yml ps
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml ps
```

Fix whatever breaks (wrong ports, missing env, build context). Then:

```powershell
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:8000/health
curl http://localhost:5001/health
```

Open the web app at its port, register a tenant, create a ticket, open the widget. Take screenshots into `evidence/infra/`.
Record image sizes: `docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" > evidence/infra/image-sizes.txt`.
Fix Dockerfile issues found (non-root user with writable paths, healthcheck uses `curl` so ensure it is installed in slim/alpine images or use `wget`/node script).

## Step 3: Kubernetes on kind

Create `infra/k8s/kind-config.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - { containerPort: 80, hostPort: 8080, protocol: TCP }
      - { containerPort: 443, hostPort: 8443, protocol: TCP }
```

```powershell
kind create cluster --name supportpilot --config infra/k8s/kind-config.yaml
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
# metrics-server on kind needs: --kubelet-insecure-tls  (patch the deployment args)
docker build -f infra/docker/Dockerfile.gateway -t supportpilot/gateway:dev .
kind load docker-image supportpilot/gateway:dev --name supportpilot
# repeat for ticket, ai, notification, web
kubectl create namespace supportpilot
# create secrets per file 01
kubectl apply -k infra/k8s/base -n supportpilot
kubectl rollout status deploy/gateway -n supportpilot
kubectl get pods,svc,hpa,ingress -n supportpilot > evidence/infra/kubectl-get.txt
```

Datastores: decide and record in an ADR. Easiest is running Mongo, Postgres, Redis and MinIO as simple Deployments with PVCs in a `base/data/` folder, or keep compose containers and point pods at `host.docker.internal`.
Verify: probes passing, `kubectl top pods` works, NetworkPolicy blocks direct access to ticket-service from a random pod (test with `kubectl run tmp --rm -it --image=busybox -- wget -qO- http://ticket-service:4001/health`), HPA scales under load (run k6 from file 03 and capture `kubectl get hpa -w`).
Make an overlay `infra/k8s/overlays/local` with image tags and replicas; use Kustomize `images:` instead of editing base files.

## Step 4: Push to GitHub and make CI green

```powershell
gh auth login
gh repo create supportpilot --public --source . --remote origin --push   # or push to the existing repo
gh run list --limit 5
gh run watch
```

Fix failures until `ci.yml` is green. Required jobs: install with cache, lint, typecheck, unit tests with coverage, Python tests, build, gitleaks, audit.
`deploy.yml`: change it so it never deploys to a nonexistent cluster. Use one of:

- Build and push images to GHCR only (`ghcr.io/<user>/supportpilot-*`), then
- A job that starts a kind cluster in the runner (`helm/kind-action`), loads images, applies `infra/k8s/overlays/local`, runs a smoke test (`curl /health` via port-forward), then tears down.
  `e2e.yml`: run Playwright and Cypress (see file 03) in CI against the compose stack.
  Add `permissions:` least privilege and `concurrency:` to each workflow. Add a CI status badge to README.

## Step 5: Capture proof

- `evidence/infra/compose-ps.txt`, screenshots of running app.
- `evidence/infra/kubectl-get.txt`, HPA scaling output.
- `evidence/infra/ci-runs.txt` from `gh run list --limit 10` and the URL of at least one green run per workflow.
- CI duration: `gh run view <id> --json startedAt,updatedAt`.

## Acceptance checklist

- [ ] `docker compose up` brings every service healthy; screenshots saved.
- [ ] kind cluster runs all services; probes and NetworkPolicy verified; output saved.
- [ ] HPA scaled at least once under load (evidence saved).
- [ ] GitHub repo has at least one green run for ci, e2e and deploy (or deploy-smoke) workflows.
- [ ] Image sizes and CI duration recorded.

## Resume gating

Allowed after this file: "Containerised services with multi-stage Docker builds; deployed to a local Kubernetes (kind) cluster with probes, HPA and NetworkPolicies; CI in GitHub Actions (average [X] min)". Not allowed: "production Kubernetes", "AWS EKS".
