output "alb_sg_id" { value = aws_security_group.alb_sg.id }
output "redis_sg" { value = aws_security_group.redis_sg.id }
output "postgres_sg" { value = aws_security_group.postgres_sg.id }
output "ecs_sg" { value = aws_security_group.ecs_service_sg.id }
