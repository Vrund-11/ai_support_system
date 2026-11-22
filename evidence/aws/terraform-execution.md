# Terraform LocalStack Infrastructure Verification Evidence (Feature 48)

## 1. Overview

In accordance with `docs/fixes/07-webhook-lambda-and-sqs.md` Step 4:

> "Note LocalStack licensing may require an account/token; if unavailable, use ElasticMQ for SQS and `sam local` for Lambda, and keep Terraform plan-only (`terraform validate` plus `plan` with mock provider settings)."
> Checklist item: "- [ ] Terraform applied against emulator (or clearly plan-only) with saved output."

This report documents the modular Terraform infrastructure implementation located at `infra/terraform/` and its verified execution plan configured for LocalStack emulation.

---

## 2. Environment & Tooling

- **Terraform Version**: `1.10.5 (windows_amd64)`
- **AWS Provider Version**: `hashicorp/aws v5.100.0`
- **Target Emulation**: LocalStack / AWS emulator (`http://localhost:4566`)
- **Execution Mode**: Plan-only verification with mock provider credentials (`mock_access_key` / `mock_secret_key`)

---

## 3. Modular Architecture Overview (`infra/terraform/`)

| File           | Resources Defined                                                                                                                                                       | Notes                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `providers.tf` | Terraform block, AWS provider with dynamic LocalStack endpoints                                                                                                         | Uses mock credentials and path-style S3                                                           |
| `variables.tf` | `aws_region`, `environment`, `localstack_endpoint`, `use_localstack`, `webhook_signing_secret`                                                                          | Parameterized inputs                                                                              |
| `sqs.tf`       | `aws_sqs_queue.webhooks`, `aws_sqs_queue.webhooks_dlq`, `aws_sqs_queue_policy.webhooks_policy`                                                                          | Configures `maxReceiveCount = 5` and 14-day DLQ retention                                         |
| `lambda.tf`    | `aws_iam_role.lambda_exec`, `aws_iam_role_policy.lambda_policy`, `aws_lambda_function.webhook_dispatcher`, `aws_lambda_event_source_mapping.sqs_trigger`                | Python 3.12 runtime, handler `handlers.webhook.handler`, `ReportBatchItemFailures`, batch size 10 |
| `ssm.tf`       | `aws_ssm_parameter.webhook_signing_secret`, `aws_ssm_parameter.sqs_queue_url`, `aws_ssm_parameter.s3_bucket`                                                            | Parameter Store secrets and config                                                                |
| `s3.tf`        | `aws_s3_bucket.attachments`, `aws_s3_bucket_server_side_encryption_configuration.attachments_encryption`, `aws_s3_bucket_lifecycle_configuration.attachments_lifecycle` | AES256 default encryption                                                                         |
| `outputs.tf`   | Bucket ARN, Queue URLs/ARNs, DLQ URL, Lambda ARN, SSM Parameter ARN                                                                                                     | Exposed outputs                                                                                   |

---

## 4. Verification Commands & Results

### A. Validation

```powershell
cd infra/terraform
terraform init -backend=false
terraform validate
```

**Result**:

```text
Success! The configuration is valid.
```

### B. Execution Plan

```powershell
terraform plan -no-color -var="use_localstack=true"
```

**Result**:

- **Plan Summary**: `Plan: 13 to add, 0 to change, 0 to destroy.`
- **Saved Plan**: Stored verbatim in `evidence/aws/terraform-plan.txt`.

### Key Resource Verifications:

1. **SQS Dead Letter Redrive Policy**:
   ```hcl
   redrive_policy = jsonencode({
     deadLetterTargetArn = aws_sqs_queue.webhooks_dlq.arn
     maxReceiveCount     = 5
   })
   ```
2. **Lambda Event Source Mapping Partial Failures**:
   ```hcl
   function_response_types = ["ReportBatchItemFailures"]
   batch_size              = 10
   ```
3. **SSM Signing Secret**:
   ```hcl
   name = "/supportpilot/dev/WEBHOOK_SIGNING_SECRET"
   type = "SecureString"
   ```

---

## 5. Summary

All Terraform modules validate without errors or warnings, and the plan confirms complete resource provisioning for SQS, DLQ, Lambda, SSM, and S3.
