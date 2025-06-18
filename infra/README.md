# Sidekick Infrastructure (Terraform)

This Terraform project deploys a containerized application ("Sidekick") on AWS with supporting services. The infrastructure includes networking, security, databases, and orchestration components.

## Architecture Overview

```
Pending
```

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
- **ALB (`alb` module)**: Routes traffic to ECS tasks
- **PostgreSQL (`rds` module)**: Managed database for application data
- **Redis (`redis` module)**: Cache layer with replication

### 4. Container Orchestration (`ecs` module)
- **ECS Cluster**: Runs Fargate tasks
- **Task Definition**: Container specs (2 vCPU/4GB RAM)
- **Service**: Maintains desired task count

### 5. Supporting Services
- **ECR**: Stores container images
- **Secrets Manager (`kms` module)**: Stores credentials securely
- **IAM (`iam` module)**: Execution roles with necessary permissions

## How It Works

1. User traffic hits the ALB
2. ALB forwards requests to ECS tasks in private subnets
3. ECS tasks connect to:
   - PostgreSQL for persistent data
   - Redis for caching

### Testing the Deployment
After applying the Terraform configuration, test the endpoint:

```bash
curl http://sidekick-alb-856591864.us-west-2.elb.amazonaws.com/
```

Expected response:
```json
{"status":"ok"}
```

## Deployment

```bash
terraform init
terraform plan
terraform apply
```

## Variables to Customize

Key variables to review before deployment:
- VPC CIDR block
- Instance sizes (RDS, Redis, ECS tasks)
- Container image location (ECR)
- Secrets (stored in AWS Secrets Manager)

## Outputs

The deployment outputs:
- ALB DNS name (access point for the application)
- RDS endpoint
- Redis primary endpoint
- ECR repository URL