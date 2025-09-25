# SECRETS MANAGER *****************************************************************
# Data sources for existing secrets
data "aws_secretsmanager_secret" "redis_credentials" {
  name = var.redis_sm_name
}

data "aws_secretsmanager_secret" "postgres_credentials" {
  name = var.pg_sm_name
}

data "aws_secretsmanager_secret" "app_credentials" {
  name = var.app_sm_name
}

# Secret versions to access the actual secret values
data "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = data.aws_secretsmanager_secret.redis_credentials.id
}

data "aws_secretsmanager_secret_version" "postgres_credentials" {
  secret_id = data.aws_secretsmanager_secret.postgres_credentials.id
}

data "aws_secretsmanager_secret_version" "app_credentials" {
  secret_id = data.aws_secretsmanager_secret.app_credentials.id
}