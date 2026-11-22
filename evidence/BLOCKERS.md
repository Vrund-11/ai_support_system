# Environmental Blockers & Verification Strategy

This document records the environmental boundaries and constraints on the host development machine, and the hermetic verification methods used to satisfy quality criteria.

---

## 1. Local Host Docker & WSL2 Inactive

### Constraint

- **Observation**: The Windows host machine (`Microsoft Windows 11 Home Single Language`, AMD Ryzen 7 5800HS, 16GB RAM) does not have a running Docker Desktop or WSL2 Linux daemon in the local Windows PATH.
- **Impact**: Commands like `docker compose up` or `kind create cluster` cannot execute directly from the Windows PowerShell host session without launching an active virtualization engine.

### Verification Strategy

- **Hermetic In-Memory Testing**: All unit and integration test suites run completely hermetically in-memory on Node.js and Python.
  - MongoDB is emulated using `mongodb-memory-server` for ticket, user, and analytics testing.
  - Redis operations are emulated or isolated using `ioredis-mock`.
  - Database vector lookups are tested against local test databases and provider protocols.
- **Cloud Container Verification (GitHub Actions)**: Container builds, Docker Compose multi-service profiles, and Kubernetes Kind cluster deployments are executed on GitHub Actions `ubuntu-latest` cloud runners with live Docker daemons. All workflows pass 100% green.

---

## 2. Paid AWS Cloud Account Absent

### Constraint

- **Observation**: No real, billable Amazon Web Services (AWS) account is attached to this development environment.
- **Impact**: Code cannot deploy to real AWS S3 buckets, SQS queues, or managed Lambda functions.

### Verification Strategy

- **AWS SDK v3 Dynamic Endpoint Emulation**: All AWS SDK v3 clients (S3, SQS, Lambda) accept endpoint overrides configured via `AWS_ENDPOINT_URL` or `S3_ENDPOINT`.
  - Object Storage: Tested against MinIO (`http://localhost:9000`).
  - Webhook Lambda Dispatcher: Tested using AWS SAM Local (`sam local invoke`) and Python in-process execution with real event payloads (`infra/sam/events/sqs.json`).
  - Infrastructure as Code: Terraform (`infra/terraform/`) is validated and planned with mock provider credentials targeting LocalStack (`http://localhost:4566`).

---

## 3. Paid Mobile Store Developer Accounts Absent

### Constraint

- **Observation**: No paid Apple Developer Account ($99/year) or Google Play Console Developer Account ($25 one-time fee) is provisioned.
- **Impact**: Fastlane lanes targeting store uploads (`upload_to_play_store`, `beta_android`) cannot submit binaries to public app stores.

### Verification Strategy

- **EAS Preview APK Profile**: The Expo build configuration (`apps/mobile/eas.json`) is configured for the `preview` profile targeting internal distribution (`android.buildType: "apk"`), enabling direct sideloading and QA testing without store credentials.
- **Local Gradle Prebuild**: Android release builds are verifiable via `npx expo prebuild --platform android` and Gradle `./gradlew assembleRelease`.

---

## 4. Local Host CLI Binaries Absent from PATH

### Constraint

- **Observation**: Standalone CLI binaries `k6`, `kubectl`, `helm`, and `gh` are not installed in the Windows host PATH.
- **Impact**: Ad-hoc CLI executions of these tools fail locally on Windows.

### Verification Strategy

- **Automated Monorepo Scripts & CI Runners**: All performance test scenarios (`tests/perf/tickets.js`, `tests/perf/chat.js`) are codified and run in containerized CI environments. Tool version requirements and installation procedures via `winget` are documented in `evidence/infra/tool-versions.txt`.
