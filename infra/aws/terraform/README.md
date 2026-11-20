# SupportPilot Infrastructure as Code (Terraform & LocalStack)

This directory provisions the AWS infrastructure used by SupportPilot:

1. **S3 Attachments Bucket**: Encrypted bucket for customer & agent attachments with 7-day multipart upload expiration.
2. **SQS Webhooks Delivery Queue + DLQ**: SQS queue fed by `notification-service` with a dead-letter queue (DLQ) after 6 failed delivery retries.
3. **Webhook Dispatcher Lambda**: Serverless function triggered by SQS events, verifying tenant isolation, signing payloads with HMAC-SHA256, and dispatching to external webhook endpoints with partial batch failure reporting.
4. **SSM Parameters**: Configuration parameters for bucket and queue discovery.

## Local Emulation with LocalStack

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.5.0
- [LocalStack](https://github.com/localstack/localstack) (or `pip install terraform-local`)

### Running against LocalStack

```bash
# 1. Start LocalStack container
docker run --rm -it -p 4566:4566 localstack/localstack

# 2. Use tflocal (LocalStack Terraform wrapper)
tflocal init
tflocal plan
tflocal apply
```

Alternatively with vanilla Terraform:

```bash
terraform init
terraform apply -var="use_localstack=true" -var="localstack_endpoint=http://localhost:4566"
```

## Deploying to Real AWS

To deploy to real AWS:

1. Ensure your AWS credentials are configured (`aws configure` or IAM role).
2. Run Terraform without LocalStack flags:
   ```bash
   terraform init
   terraform apply -var="use_localstack=false" -var="aws_region=ap-south-1" -var="environment=prod"
   ```

### Key Differences in Real AWS vs LocalStack

- **IAM Policies**: Real AWS enforces granular IAM policies strictly (defined in `infra/aws/iam/`).
- **Networking & VPC**: In production, Lambdas and SQS queues may reside inside private subnets with VPC endpoints.
- **Cost & Quotas**: Real AWS applies S3 request costs and SQS API costs; LocalStack is completely free for local testing.
