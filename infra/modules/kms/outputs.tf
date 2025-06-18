# Secrets Manager ARN outputs
output "redis_credentials_secret_arn" {
  value = aws_secretsmanager_secret.redis_credentials.arn
}

output "postgres_credentials_secret_arn" {
  value = aws_secretsmanager_secret.postgres_credentials.arn
}

output "app_credentials_secret_arn" {
  value = aws_secretsmanager_secret.app_credentials.arn
}

# Secret version outputs
output "postgres_credentials_secret_string" {
  value     = data.aws_secretsmanager_secret_version.postgres_credentials.secret_string
  sensitive = true
}

output "redis_credentials_secret_string" {
  value     = data.aws_secretsmanager_secret_version.redis_credentials.secret_string
  sensitive = true
}

output "app_credentials_secret_string" {
  value     = data.aws_secretsmanager_secret_version.app_credentials.secret_string
  sensitive = true
}
