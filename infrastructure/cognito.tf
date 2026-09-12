resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

  alias_attributes         = ["email", "phone_number"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    attribute_data_type = "String"
    mutable             = true
    name                = "role"

    string_attribute_constraints {
      min_length = 3
      max_length = 32
    }
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${local.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]
  callback_urls                = [var.app_url, "http://localhost:3000"]
  logout_urls                  = [var.app_url, "http://localhost:3000"]

  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = [
    "email",
    "openid",
    "phone",
    "profile"
  ]
  allowed_oauth_flows_user_pool_client = true
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${local.name_prefix}-${random_id.suffix.hex}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_group" "citizen" {
  name         = "citizen"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Public citizens"
}

resource "aws_cognito_user_group" "ngo" {
  name         = "ngo"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "NGO and field workers"
}

resource "aws_cognito_user_group" "government" {
  name         = "government"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Government admins"
  precedence   = 0
}
