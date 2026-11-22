# ── IAM Role and Policies for Webhook Lambda ──

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
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = aws_ssm_parameter.webhook_signing_secret.arn
      }
    ]
  })
}

# ── Webhook Dispatcher Lambda Function (Python 3.12) ──

resource "aws_lambda_function" "webhook_dispatcher" {
  function_name = "supportpilot-webhook-dispatcher-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handlers.webhook.handler"
  runtime       = "python3.12"
  timeout       = 10
  memory_size   = 256

  filename         = "${path.module}/dummy-lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/dummy-lambda.zip")

  environment {
    variables = {
      WEBHOOK_SIGNING_SECRET = var.webhook_signing_secret
      WEBHOOK_ALLOW_LOCAL    = "false"
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
