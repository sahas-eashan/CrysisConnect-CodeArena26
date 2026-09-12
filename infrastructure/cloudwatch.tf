resource "aws_cloudwatch_log_group" "resolver" {
  name              = "/aws/lambda/${local.name_prefix}-resolver"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.name_prefix}-worker"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "ai" {
  name              = "/aws/lambda/${local.name_prefix}-ai"
  retention_in_days = 7
}
