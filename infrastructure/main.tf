terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "archive_file" "resolver_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/resolver"
  output_path = "${path.module}/build/resolver.zip"
}

data "archive_file" "worker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/worker"
  output_path = "${path.module}/build/worker.zip"
}

data "archive_file" "ai_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/ai"
  output_path = "${path.module}/build/ai.zip"
}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}
