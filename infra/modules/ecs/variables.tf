# ECS Cluster Variables
variable "ecs_name" {}
variable "ecs_settings_name" {}
variable "ecs_settings_value" {}

# ECS Task Definition Variables
variable "ecs_task_family" {}
variable "ecs_task_network_mode" {}
variable "ecs_task_compatibilities" {}
variable "ecs_task_cpu" {}
variable "ecs_task_memory" {}
variable "ecs_task_execution_role_arn" {}
variable "ecs_task_role_arn" {}
variable "ecs_task_depends_on" {}

# Container Definition Variables
variable "ecs_task_definition_name" {}
variable "ecs_task_definition_image" {}
variable "ecs_task_definition_essential" {}
variable "ecs_task_definition_portMappings_port" {}
variable "ecs_task_definition_portMappings_host_port" {}
variable "ecs_task_definition_portMappings_protocol" {}
variable "ecs_task_definition_logconfig_driver" {}
variable "ecs_task_definition_logconfig_group" {}
variable "ecs_task_definition_logconfig_region" {}
variable "ecs_task_definition_logconfig_stream_prefix" {}

# Environment Variables (as list of objects)
variable "ecs_task_environment" {
  type = list(object({
    name  = string
    value = string
  }))
}

# ECS Service Variables
variable "ecs_service_name" {}
variable "ecs_service_desired_Count" {}
variable "ecs_service_launch_type" {}
variable "ecs_service_network_subnets" { type = list(string) }
variable "ecs_service_security_group" {}
variable "ecs_service_lb_target_group_arn" {}
variable "ecs_service_lb_container_name" {}
variable "ecs_service_lb_container_port" {}
