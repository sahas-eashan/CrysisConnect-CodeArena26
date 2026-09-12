resource "aws_appsync_graphql_api" "main" {
  name                = "${local.name_prefix}-api"
  authentication_type = "AMAZON_COGNITO_USER_POOLS"
  schema              = file("${path.module}/schema.graphql")

  user_pool_config {
    aws_region     = var.aws_region
    user_pool_id   = aws_cognito_user_pool.main.id
    default_action = "ALLOW"
  }

  log_config {
    cloudwatch_logs_role_arn = aws_iam_role.appsync_logs.arn
    field_log_level          = "ERROR"
  }

  xray_enabled = true
}

resource "aws_appsync_datasource" "lambda_resolver" {
  api_id           = aws_appsync_graphql_api.main.id
  name             = "LambdaResolver"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_lambda.arn

  lambda_config {
    function_arn = aws_lambda_function.resolver.arn
  }
}

resource "aws_appsync_datasource" "lambda_ai" {
  api_id           = aws_appsync_graphql_api.main.id
  name             = "LambdaAi"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_lambda.arn

  lambda_config {
    function_arn = aws_lambda_function.ai.arn
  }
}

locals {
  resolver_fields = {
    "Query.getDisasters"               = "Query"
    "Query.getDisaster"                = "Query"
    "Query.getSafeZones"               = "Query"
    "Query.getNearestSafeZone"         = "Query"
    "Query.getResources"               = "Query"
    "Query.getResourceRequests"        = "Query"
    "Query.getMyResourceRequests"      = "Query"
    "Query.getSOSSignals"              = "Query"
    "Query.getMySOSSignals"            = "Query"
    "Query.getAlerts"                  = "Query"
    "Query.getNewsUpdates"             = "Query"
    "Query.getOrganizations"           = "Query"
    "Query.getDashboardStats"          = "Query"
    "Mutation.createDisaster"          = "Mutation"
    "Mutation.updateDisaster"          = "Mutation"
    "Mutation.createSafeZone"          = "Mutation"
    "Mutation.updateSafeZoneOccupancy" = "Mutation"
    "Mutation.createResource"          = "Mutation"
    "Mutation.updateResource"          = "Mutation"
    "Mutation.requestResource"         = "Mutation"
    "Mutation.fulfillResourceRequest"  = "Mutation"
    "Mutation.createSOS"               = "Mutation"
    "Mutation.acceptSOS"               = "Mutation"
    "Mutation.resolveSOS"              = "Mutation"
    "Mutation.createNewsUpdate"        = "Mutation"
    "Mutation.sendAlert"               = "Mutation"
    "Mutation.registerOrganization"    = "Mutation"
    "Mutation.approveOrganization"     = "Mutation"
  }
}

resource "aws_appsync_resolver" "unit" {
  for_each = local.resolver_fields

  api_id      = aws_appsync_graphql_api.main.id
  type        = each.value
  field       = split(".", each.key)[1]
  data_source = aws_appsync_datasource.lambda_resolver.name

  request_template = <<EOF
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": {
    "arguments": $util.toJson($context.arguments),
    "identity": $util.toJson($context.identity),
    "info": {
      "fieldName": "${split(".", each.key)[1]}",
      "parentTypeName": "${each.value}"
    }
  }
}
EOF

  response_template = <<EOF
$util.toJson($context.result)
EOF

}

locals {
  ai_fields = {
    "Query.getCitizenGuidance"            = "Query"
    "Query.getAiAuditLogs"                = "Query"
    "Mutation.generateIncidentBrief"      = "Mutation"
    "Mutation.generateAlertDraft"         = "Mutation"
    "Mutation.recommendOperations"        = "Mutation"
    "Mutation.triageSosCase"              = "Mutation"
    "Mutation.recommendResourceDispatch"  = "Mutation"
    "Mutation.prepareSosSubmission"       = "Mutation"
    "Mutation.reviewAiAuditLog"           = "Mutation"
  }
}

resource "aws_appsync_resolver" "ai" {
  for_each = local.ai_fields

  api_id      = aws_appsync_graphql_api.main.id
  type        = each.value
  field       = split(".", each.key)[1]
  data_source = aws_appsync_datasource.lambda_ai.name

  request_template = <<EOF
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": {
    "arguments": $util.toJson($context.arguments),
    "identity": $util.toJson($context.identity),
    "info": {
      "fieldName": "${split(".", each.key)[1]}",
      "parentTypeName": "${each.value}"
    }
  }
}
EOF

  response_template = <<EOF
$util.toJson($context.result)
EOF
}
