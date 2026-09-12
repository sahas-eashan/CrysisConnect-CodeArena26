resource "aws_lambda_function" "resolver" {
  function_name    = "${local.name_prefix}-resolver"
  filename         = data.archive_file.resolver_zip.output_path
  source_code_hash = data.archive_file.resolver_zip.output_base64sha256
  role             = aws_iam_role.lambda_execution.arn
  handler          = "dist/index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      DB_HOST              = aws_db_instance.postgres.address
      DB_PORT              = tostring(aws_db_instance.postgres.port)
      DB_NAME              = var.db_name
      DB_USER              = var.db_username
      DB_PASSWORD          = var.db_password
      S3_BUCKET            = aws_s3_bucket.uploads.bucket
      SNS_TOPIC_ARN        = aws_sns_topic.alerts.arn
      SES_FROM             = var.ses_sender_email
      WORKER_FUNCTION_NAME = aws_lambda_function.worker.function_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.resolver
  ]
}

resource "aws_lambda_function" "worker" {
  function_name    = "${local.name_prefix}-worker"
  filename         = data.archive_file.worker_zip.output_path
  source_code_hash = data.archive_file.worker_zip.output_base64sha256
  role             = aws_iam_role.lambda_execution.arn
  handler          = "dist/index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512

  environment {
    variables = {
      DB_HOST       = aws_db_instance.postgres.address
      DB_PORT       = tostring(aws_db_instance.postgres.port)
      DB_NAME       = var.db_name
      DB_USER       = var.db_username
      DB_PASSWORD   = var.db_password
      S3_BUCKET     = aws_s3_bucket.uploads.bucket
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
      SES_FROM      = var.ses_sender_email
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.worker
  ]
}

resource "aws_lambda_function" "ai" {
  function_name    = "${local.name_prefix}-ai"
  filename         = data.archive_file.ai_zip.output_path
  source_code_hash = data.archive_file.ai_zip.output_base64sha256
  role             = aws_iam_role.lambda_execution.arn
  handler          = "dist/index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      DB_HOST                      = aws_db_instance.postgres.address
      DB_PORT                      = tostring(aws_db_instance.postgres.port)
      DB_NAME                      = var.db_name
      DB_USER                      = var.db_username
      DB_PASSWORD                  = var.db_password
      GEMINI_API_KEY               = var.gemini_api_key
      GEMINI_INTERACTIVE_MODEL     = "gemini-2.5-flash"
      GEMINI_ANALYSIS_MODEL        = "gemini-2.5-pro"
      AI_RATE_LIMIT_WINDOW_MINUTES = "5"
      AI_RATE_LIMIT_DEFAULT        = "10"
      AI_RATE_LIMIT_CITIZEN        = "6"
      AI_RATE_LIMIT_NGO            = "10"
      AI_RATE_LIMIT_GOVERNMENT     = "15"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ai
  ]
}

resource "aws_lambda_permission" "allow_appsync" {
  statement_id  = "AllowExecutionFromAppSync"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resolver.function_name
  principal     = "appsync.amazonaws.com"
  source_arn    = "${aws_appsync_graphql_api.main.arn}/*"
}

resource "aws_lambda_permission" "allow_appsync_ai" {
  statement_id  = "AllowExecutionFromAppSyncAi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai.function_name
  principal     = "appsync.amazonaws.com"
  source_arn    = "${aws_appsync_graphql_api.main.arn}/*"
}
