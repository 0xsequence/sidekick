variable "redis_sg_name" {}
variable "redis_sg_vpc_id" {}
variable "redis_sg_port" {}
variable "redis_sg_vpc_cidr" {}

variable "postgres_sg_name" {}
variable "postgres_sg_vpc_id" {}
variable "postgres_sg_port" {}
variable "postgres_sg_vpc_cidr" {}

variable "ecs_service_sg_name" {}
variable "ecs_service_sg_vpc_id" {}
variable "ecs_service_sg_port" {}

variable "alb_sg_name" {}
variable "alb_sg_vpc_id" {}
variable "alb_sg_pragma_cidr" {}
