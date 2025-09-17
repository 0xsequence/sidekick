resource "aws_ecs_cluster" "sidekick_cluster" {
  name = var.ecs_name
  setting {
    name  = var.ecs_settings_name
    value = var.ecs_settings_value
  }
}

resource "aws_ecs_task_definition" "sidekick_task" {
  family                   = var.ecs_task_family
  network_mode             = var.ecs_task_network_mode
  requires_compatibilities = [var.ecs_task_compatibilities]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn
  depends_on               = [var.ecs_task_depends_on]

  container_definitions = jsonencode([{
    name      = var.ecs_task_definition_name
    image     = var.ecs_task_definition_image
    essential = var.ecs_task_definition_essential

    portMappings = [{
      containerPort = var.ecs_task_definition_portMappings_port
      hostPort      = var.ecs_task_definition_portMappings_host_port
      protocol      = var.ecs_task_definition_portMappings_protocol
    }]

    logConfiguration = {
      logDriver = var.ecs_task_definition_logconfig_driver
      options = {
        "awslogs-group"         = var.ecs_task_definition_logconfig_group
        "awslogs-region"        = var.ecs_task_definition_logconfig_region
        "awslogs-stream-prefix" = var.ecs_task_definition_logconfig_stream_prefix
      }
    }

    environment = var.ecs_task_environment
  }])
}

resource "aws_ecs_service" "sidekick_service" {
  name            = var.ecs_service_name
  cluster         = aws_ecs_cluster.sidekick_cluster.id
  task_definition = aws_ecs_task_definition.sidekick_task.arn
  desired_count   = var.ecs_service_desired_Count
  launch_type     = var.ecs_service_launch_type

  network_configuration {
    subnets         = var.ecs_service_network_subnets
    security_groups = [var.ecs_service_security_group]
  }

  load_balancer {
    target_group_arn = var.ecs_service_lb_target_group_arn
    container_name   = var.ecs_service_lb_container_name
    container_port   = var.ecs_service_lb_container_port
  }
}
