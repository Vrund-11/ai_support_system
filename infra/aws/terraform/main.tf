terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = var.aws_region
  access_key                  = "mock_access_key"
  secret_key                  = "mock_secret_key"
  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack
  s3_use_path_style           = var.use_localstack

  dynamic "endpoints" {
    for_each = var.use_localstack ? [1] : []
    content {
      s3     = var.localstack_endpoint
      sqs    = var.localstack_endpoint
      lambda = var.localstack_endpoint
      iam    = var.localstack_endpoint
      ssm    = var.localstack_endpoint
      logs   = var.localstack_endpoint
    }
  }

  default_tags {
    tags = {
      Project     = "SupportPilot"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ── 1. S3 Attachments Bucket ──
resource "aws_s3_bucket" "attachments" {
  bucket        = "supportpilot-attachments-${var.environment}"
  force_destroy = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments_encryption" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "attachments_lifecycle" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ── 2. SQS Webhooks Queue & Dead Letter Queue (DLQ) ──
resource "aws_sqs_queue" "webhooks_dlq" {
  name                      = "supportpilot-webhooks-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "webhooks" {
  name                       = "supportpilot-webhooks-${var.environment}"
  visibility_timeout_seconds = 30
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhooks_dlq.arn
    maxReceiveCount     = 6
  })
}

# ── 3. IAM Role for Lambda Execution ──
resource "aws_iam_role" "lambda_exec" {
  name = "supportpilot-webhook-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "supportpilot-webhook-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.webhooks.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ── 4. Webhook Dispatcher Lambda Function ──
resource "aws_lambda_function" "webhook_dispatcher" {
  function_name = "supportpilot-webhook-dispatcher-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 10
  memory_size   = 256

  filename         = "${path.module}/dummy-lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/dummy-lambda.zip")

  environment {
    variables = {
      NODE_ENV               = "production"
      WEBHOOK_DEFAULT_SECRET = "whsec_default_signing_key_32_chars!"
    }
  }
}

# SQS to Lambda Event Source Mapping with partial batch failure reporting
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                   = aws_sqs_queue.webhooks.arn
  function_name                      = aws_lambda_function.webhook_dispatcher.arn
  batch_size                         = 10
  function_response_types            = ["ReportBatchItemFailures"]
  maximum_batching_window_in_seconds = 5
}

# ── 5. SSM Parameters ──
resource "aws_ssm_parameter" "s3_bucket" {
  name  = "/supportpilot/${var.environment}/s3_bucket"
  type  = "String"
  value = aws_s3_bucket.attachments.id
}

resource "aws_ssm_parameter" "sqs_queue_url" {
  name  = "/supportpilot/${var.environment}/webhooks_queue_url"
  type  = "String"
  value = aws_sqs_queue.webhooks.url
}
