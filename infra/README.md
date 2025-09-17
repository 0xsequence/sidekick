# Sidekick Infrastructure (Terraform)

This Terraform project deploys a containerized application ("Sidekick") on AWS with supporting services. The infrastructure is designed for security and isolation, with current configurations allowing internal access only.

## 🚀 Key Components

### 1. Networking (`network` module)
- **VPC**: `10.0.0.0/16` with public/private subnets across 2 AZs
- **Subnet Strategy**:
  - **Private Subnets**: `10.0.1.0/24` (us-west-2a), `10.0.2.0/24` (us-west-2b) - For ECS tasks, RDS, Redis
  - **ALB Subnets**: `10.0.3.0/24` (us-west-2a), `10.0.4.0/24` (us-west-2b) - Currently public but will be private after VPC peering
  - **NAT Subnet**: `10.0.5.0/24` (us-west-2a) - Public subnet for NAT Gateway only
- **NAT Gateway**: Allows outbound internet access for private resources
- **Route Tables**: Separate routing for public and private subnets
- **Subnet Groups**: Dedicated subnet groups for Redis and PostgreSQL

### 2. Security Groups (`security_groups` module)
**Current Security Configuration:**
- **Redis SG**: Port 6379 open to entire VPC CIDR (`10.0.0.0/16`)
- **PostgreSQL SG**: Port 5432 open to entire VPC CIDR (`10.0.0.0/16`)  
- **ECS Service SG**: Port 7500 open to:
  - ALB Security Group - For internal load balancer communication
- **ALB SG**: Ports 80, 443, 7500 open to `0.0.0.0/0` but ALB is internal (not internet-facing)

### 3. Core Services
- **ALB**: Internal Application Load Balancer (not internet-facing)
- **PostgreSQL RDS**: Managed database for application data (PostgreSQL 17)
- **Redis ElastiCache**: Redis 7.1 cache layer with replication
- **ECR**: Container registry for Sidekick application images

### 4. Container Orchestration (`ecs` module)
- **ECS Cluster**: Runs Fargate tasks in private subnets with container insights enabled
- **Task Definition**: 1 vCPU/2GB RAM container specs
- **Service**: Maintains desired task count with load balancer integration
- **CloudWatch Logs**: Centralized logging with 3-day retention

### 5. Security & Access Management
- **Secrets Manager**: Secure credential storage for Redis, PostgreSQL, and app credentials
- **KMS**: Encryption for secrets at rest
- **IAM Roles**: Execution roles with necessary permissions for ECS tasks
- **WAF**: Web Application Firewall protection for the ALB with AWS managed rules

## 🔄 How It Works - Data Flow

### Detailed Flow:
1. **Load Balancing**: ALB (internal) receives requests and routes to ECS tasks
2. **Container Processing**: ECS tasks in private subnets process requests
3. **Data Access**: 
   - Persistent data: PostgreSQL RDS
   - Caching: Redis ElastiCache
4. **Response**: Processed responses return through ALB to originating VPC

## 🔐 Current Access Status

### 🚫 External Internet Access: **BLOCKED**
- ALB is configured as `internal = true`
- No direct internet access to application
- Outbound internet available via NAT Gateway for updates/package fetching/pull docker images

### ✅ Internal VPC Access: **ACTIVE**
- All components within the VPC can communicate:
  - ECS → PostgreSQL: Port 5432
  - ECS → Redis: Port 6379  
  - ALB → ECS: Port 7500

## 🛠️ Deployment

### Prerequisites
- Terraform >= 1.2.0
- AWS CLI configured with appropriate permissions (get secrets)
- Secrets pre-populated in AWS Secrets Manager:
  - `sidekick/redis/credentials`
  - `sidekick/postgres/credentials` 
  - `sidekick/app/credentials`

### Deployment Commands
```bash
# Initialize Terraform (first time)
terraform init

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply
```

### Backend Configuration
Terraform state is stored in S3 with encryption:
- Bucket: `terraform-state-bucket-sidekick`
- Key: `sidekick/terraform.tfstate`
- Region: `us-west-2`

## 📊 Monitoring & Logging

### CloudWatch Insights Queries

#### A. High Error Rate
1. **Check recent errors**:
   ```sql
   filter @message like /statusCode\": [45]\d{2}/
   | sort @timestamp desc
   | limit 20
   ```
2. **Recent errors by path**:  
   ```sql
   filter @message like /statusCode\": [45]\d{2}/
   | parse @message /\"url\": \"(?<route>[^\"]+)/
   | stats count(*) by route, statusCode
   | sort @timestamp desc  
   ```

#### B. Latency Spikes
1. **Identify slow routes**:
   ```sql
   parse @message /responseTime\": (?<rt>\d+\.\d+).*\"url\": \"(?<route>[^\"]+)/
   | stats avg(rt) by route
   ```
2. **Slow routes P99**:  
   ```sql
   parse @message /responseTime\": (?<rt>\d+\.\d+).*\"url\": \"(?<route>[^\"]+)/
   | stats avg(rt), percentile(rt, 99) as p99 by route
   ```

#### C. Missing Requests
1. **Find incomplete requests**:
   ```sql
   parse @message /incoming request req-(?<id>\w+)/
   | filter @message not like /completed/
   ```

## 🔧 Environment Variables Configuration

The Sidekick application requires the following environment variables configured in the ECS task:

### Required Variables:
- `SEQUENCE_PROJECT_ACCESS_KEY`: Your project access key from Sequence Builder
- `EVM_PRIVATE_KEY`: Private key for the backend wallet (if using local signer)

### Core Configuration:
- `PORT=7500`: Application port (ALB routes to this port)
- `HOST=0.0.0.0`: Bind address
- `NODE_ENV=production`: Runtime environment
- `DEBUG=false`: Set to `true` for verbose logging

### Database & Cache:
- `DATABASE_URL`: PostgreSQL connection string (automatically generated from secrets)
- `REDIS_HOST`: Redis endpoint address (automatically retrieved from ElastiCache)
- `REDIS_PORT=6379`: Redis port
- `REDIS_PASSWORD`: Optional Redis auth password (from secrets)

### Security:
- `SIDEKICK_API_SECRET_KEY`: API secret for additional security layer
- `SIGNER_TYPE`: Wallet signer type (`local`, `aws_kms`, or `google_kms`)

### AWS KMS Configuration (if using AWS KMS signer):
- `AWS_REGION`: AWS region for KMS
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_KMS_KEY_ID`: KMS key identifier

### Optional:
- `ETHERSCAN_API_KEY`: For contract verification
- `VERIFY_CONTRACT_ON_DEPLOY`: Set to enable auto-verification

### Google KMS Configuration (alternative):
- `PROJECT`: GCP project ID
- `LOCATION`: KMS key location
- `KEY_RING`: KMS key ring name
- `CRYPTO_KEY`: KMS crypto key name
- `CRYPTO_KEY_VERSION`: KMS key version

## 📁 Module Structure

The infrastructure is organized into reusable Terraform modules:

- `network`: VPC, subnets, routing, and NAT gateway
- `security_groups`: Security group definitions and rules
- `kms`: Secrets Manager resources for credentials
- `waf`: Web Application Firewall configuration
- `alb`: Application Load Balancer with target groups
- `redis`: ElastiCache Redis cluster
- `rds`: PostgreSQL RDS instance
- `iam`: IAM roles and policies for ECS execution
- `ecs`: ECS cluster, task definition, and service

## 🔄 Operational Runbook

### Scaling
- Adjust `ecs_service_desired_Count` in ECS module for horizontal scaling
- Modify `ecs_task_cpu` and `ecs_task_memory` for vertical scaling
- RDS and Redis can be scaled by modifying instance types and configurations

### Backup & Recovery
- RDS automated backups are enabled by default
- Redis data persistence depends on configuration
- Terraform state is stored in S3 for infrastructure recovery