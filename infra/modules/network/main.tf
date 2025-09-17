resource "aws_vpc" "sidekick_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "sidekick_private_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.private_subnet_1_cidr
  availability_zone = var.private_subnet_1_az_1
}

resource "aws_subnet" "sidekick_private_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.private_subnet_2_cidr
  availability_zone = var.private_subnet_1_az_2
}

resource "aws_subnet" "alb_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.alb_subnet_1_cidr
  availability_zone = var.alb_subnet_1_az
}

resource "aws_subnet" "alb_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.alb_subnet_2_cidr
  availability_zone = var.alb_subnet_2_az
}

# Public Subnet (ONLY for NAT Gateway)
resource "aws_subnet" "public_nat" {
  vpc_id                  = aws_vpc.sidekick_vpc.id
  cidr_block              = var.public_nat_cidr
  availability_zone       = var.public_nat_az
  map_public_ip_on_launch = true
}

# Internet Gateway
resource "aws_internet_gateway" "sidekick_igw" {
  vpc_id = aws_vpc.sidekick_vpc.id
}

resource "aws_eip" "nat" {}

resource "aws_nat_gateway" "sidekick_nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_nat.id
  depends_on    = [aws_internet_gateway.sidekick_igw, aws_eip.nat]
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

# Associate private subnets

resource "aws_route_table_association" "public_nat" {
  subnet_id      = aws_subnet.public_nat.id
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

resource "aws_route_table_association" "alb_1" {
  subnet_id      = aws_subnet.alb_subnet_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "alb_2" {
  subnet_id      = aws_subnet.alb_subnet_2.id
  route_table_id = aws_route_table.public.id
}

# Subnet Groups
resource "aws_elasticache_subnet_group" "sidekick_redis" {
  name       = "sidekick-redis-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
}

resource "aws_db_subnet_group" "sidekick_postgres" {
  name       = "sidekick-postgres-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]
}