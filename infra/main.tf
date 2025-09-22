# Network *****************************************************************

module "network" {
  source                = "./modules/network"
  vpc_cidr              = "10.0.0.0/16"
  private_subnet_1_cidr = "10.0.1.0/24"
  private_subnet_2_cidr = "10.0.2.0/24"
  private_subnet_1_az_1 = "us-west-2a"
  private_subnet_1_az_2 = "us-west-2b"
  alb_subnet_1_cidr     = "10.0.3.0/24"
  alb_subnet_1_az       = "us-west-2a"
  alb_subnet_2_cidr     = "10.0.4.0/24"
  alb_subnet_2_az       = "us-west-2b"
  public_nat_cidr       = "10.0.5.0/24"
  public_nat_az         = "us-west-2a"
  aws_route_pragma_peer_cidrs  = var.vpc_peering_connection_cidrs
  aws_route_pragma_peer_ids  = var.vpc_peering_connection_ids
}

# Security Groups ************************************************

module "security_groups" {
  source = "./modules/security_groups"

  redis_sg_name     = "sidekick-redis-sg"
  redis_sg_vpc_id   = module.network.vpc_id
  redis_sg_port     = 6379
  redis_sg_vpc_cidr = module.network.vpc_cidr

  postgres_sg_name     = "sidekick-postgres-sg"
  postgres_sg_vpc_id   = module.network.vpc_id
  postgres_sg_port     = 5432
  postgres_sg_vpc_cidr = module.network.vpc_cidr

  ecs_service_sg_name   = "sidekick-ecs-service-sg"
  ecs_service_sg_vpc_id = module.network.vpc_id
  ecs_service_sg_port   = 7500

  # Public ALB SG
  alb_sg_name   = "sidekick-alb-sg"
  alb_sg_vpc_id = module.network.vpc_id

  # Internal ALB SG
  alb_internal_sg_name   = "sidekick-alb-internal-sg"
  alb_internal_sg_vpc_id = module.network.vpc_id

  aws_route_pragma_peer_cidrs = var.vpc_peering_connection_cidrs
}

# KMS **************************************************************

module "kms" {
  source        = "./modules/kms"
  redis_sm_name = "sidekick/redis/credentials"
  pg_sm_name    = "sidekick/postgres/credentials"
  app_sm_name   = "sidekick/app/credentials"
}

# WAF ******************************************************************

module "waf" {
  source   = "./modules/waf"
  waf_name = "sidekick-waf"
  waf_scope = "REGIONAL"
  
  # Associate with both ALBs
  waf_association_lb_arns = [
    module.load_balancer.alb_arn,
    module.load_balancer.alb_internal_arn 
  ]
}

# Application Load Balancer ********************************************************************

module "load_balancer" {
  source = "./modules/alb"

  # ALB Variables
  alb_name     = "sidekick-alb"
  alb_internal = false
  alb_type     = "application"
  alb_sg       = module.security_groups.alb_sg_id
  alb_sb_1     = module.network.alb_subnet_1
  alb_sb_2     = module.network.alb_subnet_2

  # Target Group Variables
  alb_target_group_name     = "sidekick-tg"
  alb_target_group_port     = 7500
  alb_target_group_protocol = "HTTP"
  alb_target_group_type     = "ip"
  alb_target_group_vpc_id   = module.network.vpc_id

  # Listener Variables
  alb_listener_port     = "80"
  alb_listener_protocol = "HTTP"
  alb_listener_type     = "forward"

    # Internal ALB Variables
  alb_internal_name     = "sidekick-alb-internal"
  alb_internal_var      = true
  alb_internal_type     = "application"
  alb_internal_sg       = module.security_groups.alb_internal_sg_id
  alb_internal_sb_1     = module.network.private_subnet_id_1
  alb_internal_sb_2     = module.network.private_subnet_id_2
}

# # Redis ElastiCache Cluster *****************************************************************
module "redis" {
  source = "./modules/redis"

  elastic_cache_id                         = "sidekick-redis"
  elastic_cache_engine                     = "redis"
  elastic_cache_version                    = "7.1"
  elastic_cache_node_type                  = "cache.t4g.micro"
  elastic_cache_port                       = 6379
  elastic_cache_failover_enabled           = true
  elastic_cache_rest_encryption_enabled    = true
  elastic_cache_transit_encryption_Enabled = false
  elastic_cache_sg                         = module.network.redis_subnet_group_name
  elastic_cache_security_group             = module.security_groups.redis_sg
  elastic_cache_num_nodes                  = 1
  elastic_cache_replicas_node              = 1
}


# ECR *****************************************************************
resource "aws_ecr_repository" "sidekick_test_ecr" {
  name                 = "sidekick/test-01"
  image_tag_mutability = "MUTABLE"
}


# Postgres RDS *****************************************************************

module "postgres" {
  source = "./modules/rds"

  rds_id                    = "sidekick-postgres"
  rds_name                  = "sequence_sidekick"
  rds_engine                = "postgres"
  rds_engine_version        = "17"
  rds_instance_class        = "db.t4g.micro"
  rds_allocated_storage     = 20
  rds_max_allocated_storage = 100
  rds_port                  = 5432
  rds_auth_username         = jsondecode(module.kms.postgres_credentials_secret_string)["username"]
  rds_auth_password         = jsondecode(module.kms.postgres_credentials_secret_string)["password"]
  rds_db_subnet_name        = module.network.postgres_subnet_group_name
  rds_security_group        = module.security_groups.postgres_sg
  rds_publicly_accessible   = false
  rds_insights_enabled      = true
  rds_Storage_encrypted     = true
  rds_deletion_protection   = false
  rds_parameter_group_name  = "default.postgres17"
  rds_skip_final_snapshot   = true
}

#
resource "aws_cloudwatch_log_group" "sidekick_logs" {
  name              = "/ecs/sidekick-task"
  retention_in_days = 3
}

# # IAM ****************************************************************************
module "iam" {
  source = "./modules/iam"

  iam_role_ecs_task_execution_name = "sidekick-ecs-task-execution-role"
  iam_policy_logs_access_name      = "sidekick-logs-access"
  iam_policy_log_access_resource   = aws_cloudwatch_log_group.sidekick_logs.arn
}


# # ECS Definition ************************************************************************

module "ecs" {
  source = "./modules/ecs"

  # Cluster
  ecs_name           = "sidekick-cluster"
  ecs_settings_name  = "containerInsights"
  ecs_settings_value = "enabled"

  # Task Definition
  ecs_task_family             = "sidekick-task"
  ecs_task_network_mode       = "awsvpc"
  ecs_task_compatibilities    = "FARGATE"
  ecs_task_cpu                = 1024
  ecs_task_memory             = 2048
  ecs_task_execution_role_arn = module.iam.execution_task_role
  ecs_task_role_arn           = module.iam.execution_task_role
  ecs_task_depends_on         = aws_cloudwatch_log_group.sidekick_logs

  # Container
  ecs_task_definition_name                    = "sidekick-container"
  ecs_task_definition_image                   = "ghcr.io/0xsequence/sidekick:wip-aws-infra"
  ecs_task_definition_essential               = true
  ecs_task_definition_portMappings_port       = 7500
  ecs_task_definition_portMappings_host_port  = 7500
  ecs_task_definition_portMappings_protocol   = "tcp"
  ecs_task_definition_logconfig_driver        = "awslogs"
  ecs_task_definition_logconfig_group         = aws_cloudwatch_log_group.sidekick_logs.name
  ecs_task_definition_logconfig_region        = "us-west-2"
  ecs_task_definition_logconfig_stream_prefix = "ecs"

  # Environment Variables
  ecs_task_environment = [
    { name = "PORT", value = "7500" },
    { name = "HOST", value = "0.0.0.0" },
    { name = "NODE_ENV", value = "production" },
    { name = "DEBUG", value = "false" },

    # Database & Cache
    { name = "DATABASE_URL", value = "postgresql://${jsondecode(module.kms.postgres_credentials_secret_string)["username"]}:${jsondecode(module.kms.postgres_credentials_secret_string)["password"]}@${module.postgres.postgres_endpoint}/sequence_sidekick?schema=public" },
    { name = "REDIS_HOST", value = module.redis.host },
    { name = "REDIS_PORT", value = tostring(module.redis.port) },

    # Sequence Configuration
    { name = "SEQUENCE_PROJECT_ACCESS_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["SEQUENCE_PROJECT_ACCESS_KEY"] },

    # Security
    { name = "SIDEKICK_API_SECRET_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["SIDEKICK_API_SECRET_KEY"] },

    # Signer Configuration (AWS KMS)
    { name = "SIGNER_TYPE", value = "aws_kms" },
    { name = "AWS_REGION", value = "us-west-2" },
    { name = "AWS_ACCESS_KEY_ID", value = jsondecode(module.kms.app_credentials_secret_string)["AWS_ACCESS_KEY_ID"] },
    { name = "AWS_SECRET_ACCESS_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["AWS_SECRET_ACCESS_KEY"] },
    { name = "AWS_KMS_KEY_ID", value = jsondecode(module.kms.app_credentials_secret_string)["AWS_KMS_KEY_ID"] },

    # Local Signer (alternative to AWS KMS)
    { name = "EVM_PRIVATE_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["EVM_PRIVATE_KEY"] },

    # Contract Verification
    { name = "ETHERSCAN_API_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["ETHERSCAN_API_KEY"] },
    { name = "VERIFY_CONTRACT_ON_DEPLOY", value = jsondecode(module.kms.app_credentials_secret_string)["VERIFY_CONTRACT_ON_DEPLOY"] },

    # Tenderly Simulation
    { name = "TENDERLY_PROJECT_SLUG", value = jsondecode(module.kms.app_credentials_secret_string)["TENDERLY_PROJECT_SLUG"] },
    { name = "TENDERLY_ACCOUNT_SLUG", value = jsondecode(module.kms.app_credentials_secret_string)["TENDERLY_ACCOUNT_SLUG"] },
    { name = "TENDERLY_ACCESS_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["TENDERLY_ACCESS_KEY"] },

    # Google KMS (alternative signer, if needed)
    { name = "PROJECT", value = jsondecode(module.kms.app_credentials_secret_string)["PROJECT"] },
    { name = "LOCATION", value = jsondecode(module.kms.app_credentials_secret_string)["LOCATION"] },
    { name = "KEY_RING", value = jsondecode(module.kms.app_credentials_secret_string)["KEY_RING"] },
    { name = "CRYPTO_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["CRYPTO_KEY"] },
    { name = "CRYPTO_KEY_VERSION", value = jsondecode(module.kms.app_credentials_secret_string)["CRYPTO_KEY_VERSION"] },

    # Backward compatibility alias
    { name = "BACKEND_WALLET_PV_KEY", value = jsondecode(module.kms.app_credentials_secret_string)["BACKEND_WALLET_PV_KEY"] }
  ]

  # Service
  ecs_service_name                = "sidekick-service"
  ecs_service_desired_Count       = 1
  ecs_service_launch_type         = "FARGATE"
  ecs_service_network_subnets     = [module.network.private_subnet_id_1, module.network.private_subnet_id_2]
  ecs_service_security_group      = module.security_groups.ecs_sg
  ecs_service_lb_target_group_arn = module.load_balancer.lb_target_group_arn
  ecs_service_lb_container_name   = "sidekick-container"
  ecs_service_lb_container_port   = 7500
  ecs_service_lb_internal_target_group_arn = module.load_balancer.lb_target_group_internal_arn
  ecs_service_lb_internal_container_name   = "sidekick-container"
  ecs_service_lb_internal_container_port   = 7500
}
