# ALB Variables
variable "alb_name" {}
variable "alb_internal" {}
variable "alb_type" {}
variable "alb_sg" {}
variable "alb_sb_1" {}
variable "alb_sb_2" {}

# ALB INTERNAL Variables
variable "alb_internal_name" {}
variable "alb_internal_var" {}
variable "alb_internal_type" {}
variable "alb_internal_sg" {}
variable "alb_internal_sb_1" {}
variable "alb_internal_sb_2" {}

# Target Group Variables
variable "alb_target_group_name" {}
variable "alb_target_group_port" {}
variable "alb_target_group_protocol" {}
variable "alb_target_group_type" {}
variable "alb_target_group_vpc_id" {}

# Listener Variables
variable "alb_listener_port" {}
variable "alb_listener_protocol" {}
variable "alb_listener_type" {}
