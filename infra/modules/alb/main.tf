resource "aws_lb" "sidekick_alb" {
  name                       = var.alb_name
  internal                   = var.alb_internal
  load_balancer_type         = var.alb_type
  security_groups            = [var.alb_sg]
  subnets                    = [var.alb_sb_1, var.alb_sb_2]
  enable_deletion_protection = false

  tags = {
    Name      = "SidekickALB"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ApplicationLoadBalancer"
  }
}

resource "aws_lb_target_group" "sidekick_tg" {
  name        = var.alb_target_group_name
  port        = var.alb_target_group_port
  protocol    = var.alb_target_group_protocol
  target_type = var.alb_target_group_type
  vpc_id      = var.alb_target_group_vpc_id

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 10
    path                = "/"
    matcher             = "200-399"
  }

  tags = {
    Name      = "SidekickTargetGroup"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ALBTargetGroup"
  }
}

resource "aws_lb_listener" "sidekick_http" {
  load_balancer_arn = aws_lb.sidekick_alb.arn
  port              = var.alb_listener_port
  protocol          = var.alb_listener_protocol

  default_action {
    type             = var.alb_listener_type
    target_group_arn = aws_lb_target_group.sidekick_tg.arn
  }

  tags = {
    Name      = "SidekickHTTPListener"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ALBHTTPListener"
  }
}
