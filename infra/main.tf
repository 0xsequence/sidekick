# !! I will modulate this soon !!
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"

  backend "s3" {
    bucket       = "terraform-state-bucket-sidekick"
    key          = "sidekick/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-west-2"
}

# Network *****************************************************************

# Private VPC and Networking
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

# For ALB (will be private after VPC peering)
resource "aws_subnet" "alb_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-west-2a"
}

resource "aws_subnet" "alb_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = "10.0.4.0/24"
  availability_zone = "us-west-2b"
}

# 2. Public Subnet (ONLY for NAT Gateway)
resource "aws_subnet" "public_nat" {
  vpc_id                  = aws_vpc.sidekick_vpc.id
  cidr_block              = "10.0.5.0/24" # New small subnet just for NAT
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true
}

# Internet Access In the VPC for the EC2 Pull Docker Images*************************************

resource "aws_internet_gateway" "sidekick_igw" {
  vpc_id = aws_vpc.sidekick_vpc.id
}

resource "aws_nat_gateway" "sidekick_nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_nat.id # NAT lives in public subnet
  depends_on    = [aws_internet_gateway.sidekick_igw, aws_eip.nat]
}

resource "aws_eip" "nat" {
  tags = {
    Name = "sidekick-nat-eip"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.sidekick_igw.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.sidekick_nat.id
  }
}

resource "aws_route_table_association" "public_nat" {
  subnet_id      = aws_subnet.public_nat.id
  route_table_id = aws_route_table.public.id
}

# 5. Associate private subnets
resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.sidekick_private_subnet_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.sidekick_private_subnet_2.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "alb_1" {
  subnet_id      = aws_subnet.alb_subnet_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "alb_2" {
  subnet_id      = aws_subnet.alb_subnet_2.id
  route_table_id = aws_route_table.public.id
}

# Security Groups ************************************************
resource "aws_security_group" "redis_sg" {
  name        = "sidekick-redis-sg"
  description = "Security group for Sidekick Redis"
  vpc_id      = aws_vpc.sidekick_vpc.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.sidekick_vpc.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
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

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security Group for ECS Service
resource "aws_security_group" "ecs_service_sg" {
  name        = "sidekick-ecs-service-sg"
  description = "Security group for Sidekick ECS service"
  vpc_id      = aws_vpc.sidekick_vpc.id

  ingress {
    from_port       = 7500
    to_port         = 7500
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

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

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict to Pragma's IPs
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict to Pragma's IPs 
  }

  ingress {
    from_port   = 7500
    to_port     = 7500
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict to Pragma's IPs 
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Subnets Groups ****************************************************************

resource "aws_elasticache_subnet_group" "sidekick_redis" {
  name       = "sidekick-redis-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
}

resource "aws_db_subnet_group" "sidekick_postgres" {
  name       = "sidekick-postgres-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
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
  subnets            = [aws_subnet.alb_subnet_1.id, aws_subnet.alb_subnet_2.id]

  enable_deletion_protection = false

}

resource "aws_lb_target_group" "sidekick_tg" {
  name        = "sidekick-tg"
  port        = 7500
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.sidekick_vpc.id

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 10
    path                = "/"
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
  transit_encryption_enabled = false

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
}

resource "aws_ecs_cluster" "sidekick_cluster" {
  name = "sidekick-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
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

resource "aws_iam_role_policy_attachment" "elasticahe_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess"
  role       = aws_iam_role.ecs_task_execution_role.name
}

resource "aws_iam_role_policy_attachment" "rds_policy_attachment" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
  role       = aws_iam_role.ecs_task_execution_role.name
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
      { name = "REDIS_PORT", value = tostring(aws_elasticache_replication_group.sidekick_redis.port) },
      { name = "SEQUENCE_PROJECT_ACCESS_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["SEQUENCE_PROJECT_ACCESS_KEY"] },
      { name = "EVM_PRIVATE_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["EVM_PRIVATE_KEY"] },
      { name = "SIGNER_TYPE", value = "aws_kms" },
      { name = "AWS_REGION", value = "us-west-2" },
      { name = "AWS_ACCESS_KEY_ID", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["AWS_ACCESS_KEY_ID"] },
      { name = "AWS_SECRET_ACCESS_KEY", value = jsondecode(data.aws_secretsmanager_secret_version.app_credentials.secret_string)["AWS_SECRET_ACCESS_KEY"] },
    ]
  }])

}


# ECS Service
resource "aws_ecs_service" "sidekick_service" {
  name            = "sidekick-service"
  cluster         = aws_ecs_cluster.sidekick_cluster.id
  task_definition = aws_ecs_task_definition.sidekick_task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
    security_groups = [aws_security_group.ecs_service_sg.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.sidekick_tg.arn
    container_name   = "sidekick-container"
    container_port   = 7500
  }

  depends_on = [
    # aws_lb_listener.sidekick_http,
    aws_db_instance.sidekick_postgres,
    aws_elasticache_replication_group.sidekick_redis
  ]
}
