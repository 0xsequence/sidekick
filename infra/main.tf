terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-west-2"
}

# Network *****************************************************************

resource "aws_internet_gateway" "sidekick_igw" {
  vpc_id = aws_vpc.sidekick_vpc.id
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  tags = {
    Name = "sidekick-nat-eip"
  }
}

# Public Subnet for NAT Gateway (must be in same AZ as your NAT)
resource "aws_subnet" "sidekick_public_subnet" {
  vpc_id                  = aws_vpc.sidekick_vpc.id
  cidr_block              = "10.0.3.0/24"
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
}

# Second Public Subnet in a different AZ
resource "aws_subnet" "sidekick_public_subnet_2" {
  vpc_id                  = aws_vpc.sidekick_vpc.id
  cidr_block              = "10.0.4.0/24"
  availability_zone       = "us-west-2b"
  map_public_ip_on_launch = true
}

# NAT Gateway (after EIP and public subnet)
resource "aws_nat_gateway" "sidekick_nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.sidekick_public_subnet.id
  # Explicit dependencies
  depends_on = [aws_internet_gateway.sidekick_igw]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.sidekick_igw.id
  }
}


resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.sidekick_public_subnet_2.id
  route_table_id = aws_route_table.public.id
}

# Private Route Table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.sidekick_nat.id
  }
}

resource "aws_vpc" "sidekick_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "sidekick_private_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-west-2a"
}

resource "aws_subnet" "sidekick_private_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-west-2b"
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.sidekick_public_subnet.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.sidekick_private_subnet_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.sidekick_private_subnet_2.id
  route_table_id = aws_route_table.private.id
}

# Elastic Cache Subnet
resource "aws_elasticache_subnet_group" "sidekick_redis" {
  name        = "sidekick-redis-subnet-group"
  subnet_ids  = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
  description = "Subnet group for Sidekick Redis"
}

# Postgres Subnet
resource "aws_db_subnet_group" "sidekick_postgres" {
  name       = "sidekick-postgres-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]

}

resource "aws_service_discovery_private_dns_namespace" "sidekick" {
  name        = "sidekick.local"
  description = "Private DNS namespace for Sidekick services"
  vpc         = aws_vpc.sidekick_vpc.id
}



# Elastic Cache SG
resource "aws_security_group" "redis_sg" {
  name        = "sidekick-redis-sg" # Firewall identifier
  description = "Security group for Sidekick Redis"
  vpc_id      = aws_vpc.sidekick_vpc.id # Associates with your VPC

  ingress {                                         # Inbound rule:
    from_port   = 6379                              # - Redis port
    to_port     = 6379                              # - 
    protocol    = "tcp"                             # - TCP protocol only
    cidr_blocks = [aws_vpc.sidekick_vpc.cidr_block] # - Only from within VPC
  }
}

# Postgres SG
resource "aws_security_group" "postgres_sg" {
  name        = "sidekick-postgres-sg"
  description = "Security group for Sidekick PostgreSQL"
  vpc_id      = aws_vpc.sidekick_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.sidekick_vpc.cidr_block]
  }
}

# Security Group for ECS Service
resource "aws_security_group" "ecs_service_sg" {
  name        = "sidekick-ecs-service-sg"
  description = "Security group for Sidekick ECS service"
  vpc_id      = aws_vpc.sidekick_vpc.id

  # Only allow traffic from ALB on port 7500
  ingress {
    from_port       = 7500
    to_port         = 7500
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # Allow ALL outbound traffic (NAT Gateway will handle routing)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ALB Security Group
resource "aws_security_group" "alb_sg" {
  name        = "sidekick-alb-sg"
  description = "Security group for Sidekick ALB"
  vpc_id      = aws_vpc.sidekick_vpc.id

  # Allow HTTP/HTTPS from anywhere (or restrict to specific IPs)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict this to Pragma's IPs if known
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict this to Pragma's IPs if known
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# SECRETS MANAGER *****************************************************************
resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = "sidekick/redis/credentials"
  description = "Credentials for Sidekick Redis cluster"
}

resource "aws_secretsmanager_secret" "postgres_credentials" {
  name        = "sidekick/postgres/credentials"
  description = "Credentials for Sidekick PostgreSQL database"
}

resource "aws_secretsmanager_secret" "app_credentials" {
  name        = "sidekick/app/credentials"
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


# Application Load Balancer ********************************************************************
resource "aws_lb" "sidekick_alb" {
  name               = "sidekick-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets = [
    aws_subnet.sidekick_public_subnet.id,
    aws_subnet.sidekick_public_subnet_2.id
  ]

  enable_deletion_protection = false

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}

resource "aws_lb_target_group" "sidekick_tg" {
  name        = "sidekick-tg"
  port        = 7500
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.sidekick_vpc.id

  health_check {
    path                = "/health" # Update with your health check endpoint
    interval            = 30
    timeout             = 10
    healthy_threshold   = 3
    unhealthy_threshold = 3
    matcher             = "200-399"
  }
}

# Listener (HTTP)
resource "aws_lb_listener" "sidekick_http" {
  load_balancer_arn = aws_lb.sidekick_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.sidekick_tg.arn
  }
}

# # Redis ElastiCache Cluster *****************************************************************
resource "aws_elasticache_replication_group" "sidekick_redis" {
  replication_group_id       = "sidekick-redis"
  description                = "Redis cluster for Sequence Sidekick"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t4g.micro"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = jsondecode(data.aws_secretsmanager_secret_version.redis_credentials.secret_string)["auth_token"]

  subnet_group_name  = aws_elasticache_subnet_group.sidekick_redis.name
  security_group_ids = [aws_security_group.redis_sg.id]

  num_node_groups         = 1
  replicas_per_node_group = 1

  apply_immediately = false
}


# ECR *****************************************************************
resource "aws_ecr_repository" "sidekick_test_ecr" {
  name                 = "sidekick/test-01"
  image_tag_mutability = "MUTABLE"
}


# Postgres RDS *****************************************************************

resource "aws_db_instance" "sidekick_postgres" {
  identifier            = "sidekick-postgres"
  db_name               = "sequence_sidekick"
  engine                = "postgres"
  engine_version        = "17"
  instance_class        = "db.t4g.micro"
  allocated_storage     = 20
  max_allocated_storage = 100
  port                  = 5432

  username = jsondecode(data.aws_secretsmanager_secret_version.postgres_credentials.secret_string)["username"]
  password = jsondecode(data.aws_secretsmanager_secret_version.postgres_credentials.secret_string)["password"]

  db_subnet_group_name   = aws_db_subnet_group.sidekick_postgres.name
  vpc_security_group_ids = [aws_security_group.postgres_sg.id]
  publicly_accessible    = false

  performance_insights_enabled = true

  storage_encrypted   = true
  deletion_protection = false

  parameter_group_name = "default.postgres17"
  skip_final_snapshot  = true
}


# ECS Definition ************************************************************************

resource "aws_cloudwatch_log_group" "sidekick_logs" {
  name              = "/ecs/sidekick-task"
  retention_in_days = 3

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}

resource "aws_ecs_cluster" "sidekick_cluster" {
  name = "sidekick-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}

# ECS Task Execution IAM Role
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "sidekick-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for Secrets Manager access
resource "aws_iam_policy" "secrets_manager_access" {
  name        = "sidekick-secrets-manager-access"
  description = "Allows ECS tasks to access required secrets"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ],
        Resource = [
          aws_secretsmanager_secret.postgres_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.app_credentials.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "secrets_manager_access" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.secrets_manager_access.arn
}

resource "aws_iam_policy" "logs_access" {
  name        = "sidekick-logs-access"
  description = "Allows ECS tasks to write to CloudWatch Logs"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ],
        Resource = [
          "${aws_cloudwatch_log_group.sidekick_logs.arn}:*",
          "${aws_cloudwatch_log_group.sidekick_logs.arn}"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "logs_access" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.logs_access.arn
}

resource "aws_ecs_task_definition" "sidekick_task" {
  family                   = "sidekick-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_execution_role.arn
  depends_on               = [aws_cloudwatch_log_group.sidekick_logs]

  container_definitions = jsonencode([{
    name      = "sidekick-container"
    image     = "${aws_ecr_repository.sidekick_test_ecr.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 7500
      hostPort      = 7500
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.sidekick_logs.name
        "awslogs-region"        = "us-west-2"
        "awslogs-stream-prefix" = "ecs"
      }
    }

    environment = [
      { name = "PORT", value = "7500" },
      { name = "HOST", value = "0.0.0.0" },
      { name = "NODE_ENV", value = "production" },
      { name = "DEBUG", value = "false" },
      { name = "DATABASE_URL", value = "postgresql://${jsondecode(data.aws_secretsmanager_secret_version.postgres_credentials.secret_string)["username"]}:${jsondecode(data.aws_secretsmanager_secret_version.postgres_credentials.secret_string)["password"]}@${aws_db_instance.sidekick_postgres.endpoint}/sequence_sidekick?schema=public" },
      { name = "REDIS_HOST", value = aws_elasticache_replication_group.sidekick_redis.primary_endpoint_address },
      { name = "REDIS_PORT", value = "6379" },
      { name = "REDIS_PASSWORD", value = jsondecode(data.aws_secretsmanager_secret_version.redis_credentials.secret_string)["auth_token"] },
      { name = "SEQUENCE_PROJECT_ACCESS_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["SEQUENCE_PROJECT_ACCESS_KEY"] },
      { name = "EVM_PRIVATE_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["EVM_PRIVATE_KEY"] },
      { name = "AWS_ACCESS_KEY_ID", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["AWS_ACCESS_KEY_ID"] },
      { name = "AWS_SECRET_ACCESS_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["AWS_SECRET_ACCESS_KEY"] },
    ]
  }])

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}


# Allow ECS to access RDS and Redis
resource "aws_security_group_rule" "ecs_to_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs_service_sg.id
  source_security_group_id = aws_security_group.postgres_sg.id
}

resource "aws_security_group_rule" "ecs_to_redis" {
  type                     = "egress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs_service_sg.id
  source_security_group_id = aws_security_group.redis_sg.id
}

# ECS Service
resource "aws_ecs_service" "sidekick_service" {
  name            = "sidekick-service"
  cluster         = aws_ecs_cluster.sidekick_cluster.id
  task_definition = aws_ecs_task_definition.sidekick_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
    security_groups  = [aws_security_group.ecs_service_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.sidekick_tg.arn
    container_name   = "sidekick-container"
    container_port   = 7500
  }

  depends_on = [
    aws_lb_listener.sidekick_http,
    aws_db_instance.sidekick_postgres,
    aws_elasticache_replication_group.sidekick_redis
  ]

  tags = {
    Environment = "production"
    Application = "sidekick"
  }
}

# OUTPUTS ************************************************************************
output "redis_endpoint" {
  value = aws_elasticache_replication_group.sidekick_redis.primary_endpoint_address
}

output "postgres_endpoint" {
  value = aws_db_instance.sidekick_postgres.endpoint
}

output "alb_dns_name" {
  value = aws_lb.sidekick_alb.dns_name
}
