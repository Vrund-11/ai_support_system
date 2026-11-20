# Free Tools and AWS Emulation (no AWS account)

## Principle

Write code against the **AWS SDK v3** and read the endpoint from environment variables. Pointing the endpoint at an emulator gives the same code path as real AWS. This is real AWS API experience, even if the backend is an emulator.

## Service mapping

| AWS service in PRD         | Free substitute (no card)                                              | Notes                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| S3                         | **MinIO** (Docker) or **LocalStack**                                   | Presigned URLs, buckets, lifecycle rules all work. Set `S3_ENDPOINT`, `forcePathStyle: true`.           |
| Lambda                     | **AWS SAM CLI** (`sam local invoke/start-lambda`) or LocalStack Lambda | SAM CLI is free and needs only Docker. Keep handler in standard Lambda signature.                       |
| SQS                        | **LocalStack SQS** or **ElasticMQ**                                    | Used between notification-service and webhook Lambda.                                                   |
| RDS Postgres               | **Postgres + pgvector Docker image** (`pgvector/pgvector:pg16`)        | Optional free hosted: Neon or Supabase (pgvector supported).                                            |
| ElastiCache                | **Redis 7 Docker**                                                     | Optional: Upstash free tier.                                                                            |
| EC2 / ECS                  | Docker Compose locally; **kind** for Kubernetes                        | Optional public demo: Render, Fly.io or Oracle Cloud always-free VM (may need a card for verification). |
| ECR                        | **GitHub Container Registry (GHCR)**                                   | Free for public repos.                                                                                  |
| CloudWatch                 | **Prometheus + Grafana + Loki** in compose                             | Dashboards committed as JSON.                                                                           |
| Secrets Manager / SSM      | `.env`, Kubernetes Secrets, LocalStack SSM                             | Document the equivalent IAM policy even if not enforced.                                                |
| IAM                        | Write least-privilege policy JSON files in `infra/aws/iam/`            | LocalStack community may not enforce them; still valuable to author and review.                         |
| CloudFormation / Terraform | **Terraform with `tflocal`** against LocalStack                        | Real IaC skill without an account.                                                                      |
| SES / SNS                  | MailHog for email, LocalStack SNS if needed                            |                                                                                                         |

## LocalStack note

LocalStack's free offering and licensing have changed over time and may require a free account or auth token. Check current terms before relying on it. **No-signup fallback stack:** MinIO (S3) + ElasticMQ (SQS) + SAM CLI (Lambda) + Postgres/Redis containers. Plan for both; abstract behind env vars.

## Optional real AWS later

New AWS accounts typically offer a limited free plan or credits and require a card. If the owner later opens an account: set a billing alert first, deploy one small slice (S3 bucket plus one Lambda), tear down afterwards, and only then update resumes to say real AWS was used.

## Environment variables for portability

```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_ENDPOINT=http://localhost:9000      # MinIO, or http://localhost:4566 for LocalStack
S3_BUCKET=supportpilot-files
S3_FORCE_PATH_STYLE=true
SQS_ENDPOINT=http://localhost:4566
LAMBDA_ENDPOINT=http://localhost:3001
```

In real AWS, remove the `*_ENDPOINT` variables and use IAM roles.

## Honest resume wording

Allowed (if true): "Built S3 presigned-upload, SQS and Lambda integrations with the AWS SDK v3, developed and tested against LocalStack/MinIO; authored Terraform and IAM policies."
Not allowed unless real: "Deployed on AWS", "ran production workloads on EC2/ECS/RDS".
Interview framing: be ready to explain that the emulator mimics the API, what differs in real AWS (IAM enforcement, networking/VPC, cost, quotas), and how you would deploy for real.

## Kubernetes without cloud

Use `kind create cluster --config infra/k8s/kind-config.yaml`, install ingress-nginx, load images with `kind load docker-image`. Everything in manifests is the same as on a managed cluster.
