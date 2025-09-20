resource "aws_security_group" "redis_sg" {
  name        = var.redis_sg_name
  description = "Security group for Sidekick Redis"
  vpc_id      = var.redis_sg_vpc_id

  tags = {
    Name      = "SidekickRedisSG"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "RedisSecurity"
  }

  ingress {
    from_port   = var.redis_sg_port
    to_port     = var.redis_sg_port
    protocol    = "tcp"
    cidr_blocks = [var.redis_sg_vpc_cidr] # Pragma VPC Added
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "postgres_sg" {
  name        = var.postgres_sg_name
  description = "Security group for Sidekick PostgreSQL"
  vpc_id      = var.postgres_sg_vpc_id

  tags = {
    Name      = "SidekickPostgresSG"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PostgresSecurity"
  }

  ingress {
    from_port   = var.postgres_sg_port
    to_port     = var.postgres_sg_port
    protocol    = "tcp"
    cidr_blocks = [var.postgres_sg_vpc_cidr] # Pragma VPC Added
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_service_sg" {
  name        = var.ecs_service_sg_name
  description = "Security group for Sidekick ECS service"
  vpc_id      = var.ecs_service_sg_vpc_id

  tags = {
    Name      = "SidekickECSServiceSG"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ECSServiceSecurity"
  }

  ingress {
    from_port       = var.ecs_service_sg_port
    to_port         = var.ecs_service_sg_port
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

resource "aws_security_group" "alb_sg" {
  name        = var.alb_sg_name
  description = "Security group for Sidekick ALB"
  vpc_id      = var.alb_sg_vpc_id

  tags = {
    Name      = "SidekickALBSG"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ALBSecurity"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = concat(["88.216.233.161/32"], var.aws_route_pragma_peer_cidrs)
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = concat(["88.216.233.161/32"], var.aws_route_pragma_peer_cidrs)
  }

  ingress {
    from_port   = 7500
    to_port     = 7500
    protocol    = "tcp"
    cidr_blocks = concat(["88.216.233.161/32"], var.aws_route_pragma_peer_cidrs)
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
