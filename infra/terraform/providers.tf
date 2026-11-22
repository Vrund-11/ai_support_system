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
