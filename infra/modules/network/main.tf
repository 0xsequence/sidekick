resource "aws_vpc" "sidekick_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name      = "SidekickVPC"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "NetworkCore"
  }
}

resource "aws_subnet" "sidekick_private_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.private_subnet_1_cidr
  availability_zone = var.private_subnet_1_az_1

  tags = {
    Name      = "SidekickPrivateSubnet1"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PrivateSubnet"
    AZ        = "us-west-2a"
  }
}

resource "aws_subnet" "sidekick_private_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.private_subnet_2_cidr
  availability_zone = var.private_subnet_1_az_2

  tags = {
    Name      = "SidekickPrivateSubnet2"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PrivateSubnet"
    AZ        = "us-west-2b"
  }
}

# For ALB (will be private after VPC peering)
resource "aws_subnet" "alb_subnet_1" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.alb_subnet_1_cidr
  availability_zone = var.alb_subnet_1_az

  tags = {
    Name      = "SidekickALBSubnet1"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PublicSubnet"
    AZ        = "us-west-2a"
  }
}

resource "aws_subnet" "alb_subnet_2" {
  vpc_id            = aws_vpc.sidekick_vpc.id
  cidr_block        = var.alb_subnet_2_cidr
  availability_zone = var.alb_subnet_2_az

  tags = {
    Name      = "SidekickALBSubnet2"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PublicSubnet"
    AZ        = "us-west-2b"
  }
}

# Public Subnet (ONLY for NAT Gateway)
resource "aws_subnet" "public_nat" {
  vpc_id                  = aws_vpc.sidekick_vpc.id
  cidr_block              = var.public_nat_cidr
  availability_zone       = var.public_nat_az
  map_public_ip_on_launch = true

  tags = {
    Name      = "SidekickPublicNATSubnet"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PublicNATSubnet"
    AZ        = "us-west-2a"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "sidekick_igw" {
  vpc_id = aws_vpc.sidekick_vpc.id

  tags = {
    Name      = "SidekickIGW"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "InternetGateway"
  }
}

resource "aws_eip" "nat" {
  tags = {
    Name      = "SidekickNATEIP"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "NATElasticIP"
  }
}

resource "aws_nat_gateway" "sidekick_nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_nat.id
  depends_on    = [aws_internet_gateway.sidekick_igw, aws_eip.nat]

  tags = {
    Name      = "SidekickNATGateway"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "NATGateway"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.sidekick_igw.id
  }

  tags = {
    Name      = "SidekickPublicRouteTable"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PublicRouteTable"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.sidekick_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.sidekick_nat.id
  }

  tags = {
    Name      = "SidekickPrivateRouteTable"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PrivateRouteTable"
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

  tags = {
    Name      = "SidekickRedisSubnetGroup"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "RedisSubnetGroup"
  }
}

resource "aws_db_subnet_group" "sidekick_postgres" {
  name       = "sidekick-postgres-subnet-group"
  subnet_ids = [aws_subnet.sidekick_private_subnet_1.id, aws_subnet.sidekick_private_subnet_2.id]

  tags = {
    Name      = "SidekickPostgresSubnetGroup"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "PostgresSubnetGroup"
  }
}

# Pragma VPC Route Tables ****************************************************
resource "aws_route" "pragma_peering_public" {
  count = length(var.aws_route_pragma_peer_ids)

  route_table_id            = aws_route_table.public.id
  destination_cidr_block    = var.aws_route_pragma_peer_cidrs[count.index]
  vpc_peering_connection_id = var.aws_route_pragma_peer_ids[count.index]
}

resource "aws_route" "pragma_peering_private" {
  count = length(var.aws_route_pragma_peer_ids)

  route_table_id            = aws_route_table.private.id
  destination_cidr_block    = var.aws_route_pragma_peer_cidrs[count.index]
  vpc_peering_connection_id = var.aws_route_pragma_peer_ids[count.index]
}