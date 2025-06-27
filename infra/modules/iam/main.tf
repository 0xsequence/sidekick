resource "aws_iam_role" "ecs_task_execution_role" {
  name = var.iam_role_ecs_task_execution_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name      = "SidekickECSTaskExecutionRole"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "ECSTaskExecutionRole"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "elasticahe_policy_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonElastiCacheFullAccess"
}

resource "aws_iam_role_policy_attachment" "rds_policy_attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
}

resource "aws_iam_policy" "logs_access" {
  name        = var.iam_policy_logs_access_name
  description = "Allows ECS tasks to write to CloudWatch Logs"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ],
        Resource = [
          "${var.iam_policy_log_access_resource}:*",
          "${var.iam_policy_log_access_resource}"
        ]
      }
    ]
  })

  tags = {
    Name      = "SidekickLogsAccessPolicy"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "CloudWatchLogsAccess"
  }
}

resource "aws_iam_role_policy_attachment" "logs_access" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = aws_iam_policy.logs_access.arn
}
