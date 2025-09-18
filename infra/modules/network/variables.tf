# variables.tf
variable "vpc_cidr" {}
variable "private_subnet_1_cidr" {}
variable "private_subnet_2_cidr" {}
variable "private_subnet_1_az_1" {}
variable "private_subnet_1_az_2" {}
variable "alb_subnet_1_cidr" {}
variable "alb_subnet_1_az" {}
variable "alb_subnet_2_cidr" {}
variable "alb_subnet_2_az" {}
variable "public_nat_cidr" {}
variable "public_nat_az" {}
variable "aws_route_pragma_peer_id" {}
variable "aws_route_pragma_peer_cidr" {}
