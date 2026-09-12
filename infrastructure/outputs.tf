output "appsync_graphql_url" {
  value       = aws_appsync_graphql_api.main.uris["GRAPHQL"]
  description = "AppSync GraphQL endpoint URL."
}

output "appsync_realtime_url" {
  value       = aws_appsync_graphql_api.main.uris["REALTIME"]
  description = "AppSync realtime endpoint URL."
}

output "appsync_api_id" {
  value       = aws_appsync_graphql_api.main.id
  description = "AppSync API ID."
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "Cognito user pool ID."
}

output "cognito_user_pool_client_id" {
  value       = aws_cognito_user_pool_client.web.id
  description = "Cognito app client ID."
}

output "cognito_domain" {
  value       = aws_cognito_user_pool_domain.main.domain
  description = "Cognito hosted UI domain prefix."
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "PostgreSQL host endpoint."
}

output "rds_port" {
  value       = aws_db_instance.postgres.port
  description = "PostgreSQL port."
}

output "uploads_bucket" {
  value       = aws_s3_bucket.uploads.bucket
  description = "Uploads bucket name."
}

output "alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "SNS topic for alert fanout."
}

output "lambda_resolver_name" {
  value       = aws_lambda_function.resolver.function_name
  description = "Main AppSync resolver Lambda name."
}

output "database_bootstrap_status" {
  value       = "Database bootstrap completed during terraform apply."
  description = "Confirms the schema and seed bootstrap step ran after RDS creation."

  depends_on = [
    terraform_data.bootstrap_database
  ]
}
