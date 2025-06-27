resource "aws_db_instance" "sidekick_postgres" {
  identifier            = var.rds_id
  db_name               = var.rds_name
  engine                = var.rds_engine
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  port                  = var.rds_port

  username = var.rds_auth_username
  password = var.rds_auth_password

  db_subnet_group_name   = var.rds_db_subnet_name
  vpc_security_group_ids = [var.rds_security_group]
  publicly_accessible    = var.rds_publicly_accessible

  performance_insights_enabled = var.rds_insights_enabled

  storage_encrypted   = var.rds_Storage_encrypted
  deletion_protection = var.rds_deletion_protection

  parameter_group_name = var.rds_parameter_group_name
  skip_final_snapshot  = var.rds_skip_final_snapshot

  tags = {
    Name      = "SidekickPostgresDB"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "DatabaseServer"
  }
}
