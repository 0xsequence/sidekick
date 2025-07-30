# Sidekick Infrastructure (Terraform)

This Terraform project deploys a containerized application ("Sidekick") on AWS with supporting services. The infrastructure includes networking, security, databases, and orchestration components

## Key Components

### 1. Networking (`network` module)
- **VPC**: `10.0.0.0/16` with public/private subnets across 2 AZs
- **NAT Gateway**: Allows outbound internet access for private resources
- **Route Tables**: For public and private subnet routing

### 2. Security (`security_groups` module)
- Security groups for:
  - ALB (ports 80, 443, 7500)
  - ECS service (port 7500)
  - PostgreSQL (port 5432)
  - Redis (port 6379)

### 3. Core Services
- **ALB (`alb` module)**: Routes traffic to ECS tasks, only accessible via pragma VPC
- **PostgreSQL (`rds` module)**: Managed database for application data
- **Redis (`redis` module)**: Cache layer with replication

### 4. Container Orchestration (`ecs` module)
- **ECS Cluster**: Runs Fargate tasks
- **Task Definition**: Container specs (2 vCPU/4GB RAM)
- **Service**: Maintains desired task count

### 5. Supporting Services
- **Secrets Manager (`kms` module)**: Stores credentials securely
- **IAM (`iam` module)**: Execution roles with necessary permissions

## How It Works

1. User traffic hits the ALB
2. ALB forwards requests to ECS tasks in private subnets
3. ECS tasks connect to:
   - PostgreSQL for persistent data
   - Redis for caching

## Terraform State

- Shared state storage for team collaboration
- ersioned state file history
- Encryption for security compliance
- Locking to prevent concurrent modifications

## Operational Runbook

Example of how to configure grafana explorer to use those queries

![alt text](readme_images/image-1.png)

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
  

#### C. Missing Requests

1. **Find incomplete requests**:
   ```sql
   parse @message /incoming request req-(?<id>\w+)/
   | filter @message not like /completed/
   ```

## Deployment

```bash
terraform init
terraform plan
terraform apply
```

## Testing the Deployment

```bash
curl http://sidekick-alb-856591864.us-west-2.elb.amazonaws.com
```
Expected response:
```json
{"status":"ok","version":"1.2.0"}
```

## Environment Variables Configuration

The Sidekick application requires the following environment variables:

### Required Variables:
- `SEQUENCE_PROJECT_ACCESS_KEY`: Your project access key from Sequence Builder
- `EVM_PRIVATE_KEY`: Private key for the backend wallet (if using local signer)

### Core Configuration:
- `PORT=7500`: Application port (ALB routes to this port)
- `HOST=0.0.0.0`: Bind address
- `NODE_ENV=production`: Runtime environment
- `DEBUG=false`: Set to `true` for verbose logging

### Database & Cache:
- `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://username:password@host/dbname?schema=public`)
- `REDIS_HOST`: Redis endpoint address
- `REDIS_PORT=6379`: Redis port
- `REDIS_PASSWORD`: Optional Redis auth password

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
