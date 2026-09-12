resource "terraform_data" "bootstrap_database" {
  triggers_replace = [
    aws_db_instance.postgres.id,
    filesha256("${path.module}/../db/migrations/001_schema.sql"),
    filesha256("${path.module}/../db/seed.sql")
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    interpreter = ["PowerShell", "-Command"]
    command     = "Write-Host 'Starting database bootstrap...'; node scripts/bootstrap-db.mjs; Write-Host 'DATABASE BOOTSTRAP COMPLETED'"

    environment = {
      DB_HOST                   = aws_db_instance.postgres.address
      DB_PORT                   = tostring(aws_db_instance.postgres.port)
      DB_NAME                   = var.db_name
      DB_USER                   = var.db_username
      DB_PASSWORD               = var.db_password
      DB_BOOTSTRAP_MAX_ATTEMPTS = "30"
      DB_BOOTSTRAP_WAIT_MS      = "10000"
    }
  }

  depends_on = [
    aws_db_instance.postgres
  ]
}
