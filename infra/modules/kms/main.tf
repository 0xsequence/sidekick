# SECRETS MANAGER *****************************************************************
resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = var.redis_sm_name
  description = "Credentials for Sidekick Redis cluster"
}

resource "aws_secretsmanager_secret" "postgres_credentials" {
  name        = var.pg_sm_name
  description = "Credentials for Sidekick PostgreSQL database"
}

resource "aws_secretsmanager_secret" "app_credentials" {
  name        = var.app_sm_name
  description = "Credentials for Sidekick App"
}

# Secret Data *****************************************************************
data "aws_secretsmanager_secret" "postgres_credentials" {
  name = "sidekick/postgres/credentials"
}

data "aws_secretsmanager_secret_version" "postgres_credentials" {
  secret_id = data.aws_secretsmanager_secret.postgres_credentials.id
}

data "aws_secretsmanager_secret" "redis_credentials" {
  name = "sidekick/redis/credentials"
}

data "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = data.aws_secretsmanager_secret.redis_credentials.id
}

data "aws_secretsmanager_secret" "app_credentials" {
  name = "sidekick/app/credentials"
}

data "aws_secretsmanager_secret_version" "app_credentials" {
  secret_id = data.aws_secretsmanager_secret.app_credentials.id
}
