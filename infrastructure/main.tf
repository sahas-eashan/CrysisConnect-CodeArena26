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

resource "terraform_data" "package_lambdas" {
  triggers_replace = [
    filesha256("${path.module}/../scripts/package-lambdas.mjs"),
    filesha256("${path.module}/../lambda/resolver/index.ts"),
    filesha256("${path.module}/../lambda/resolver/package.json"),
    filesha256("${path.module}/../lambda/resolver/package-lock.json"),
    filesha256("${path.module}/../lambda/resolver/tsconfig.json"),
    filesha256("${path.module}/../lambda/worker/index.ts"),
    filesha256("${path.module}/../lambda/worker/package.json"),
    filesha256("${path.module}/../lambda/worker/package-lock.json"),
    filesha256("${path.module}/../lambda/worker/tsconfig.json"),
    filesha256("${path.module}/../lambda/ai/index.ts"),
    filesha256("${path.module}/../lambda/ai/package.json"),
    filesha256("${path.module}/../lambda/ai/package-lock.json"),
    filesha256("${path.module}/../lambda/ai/tsconfig.json")
  ]

  provisioner "local-exec" {
    command = "node ${path.module}/../scripts/package-lambdas.mjs"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "archive_file" "resolver_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/resolver"
  output_path = "${path.module}/build/resolver.zip"
  depends_on  = [terraform_data.package_lambdas]
}

data "archive_file" "worker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/worker"
  output_path = "${path.module}/build/worker.zip"
  depends_on  = [terraform_data.package_lambdas]
}

data "archive_file" "ai_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/ai"
  output_path = "${path.module}/build/ai.zip"
  depends_on  = [terraform_data.package_lambdas]
}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}
