resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
}
