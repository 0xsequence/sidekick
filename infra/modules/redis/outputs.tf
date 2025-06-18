output "host" { value = aws_elasticache_replication_group.sidekick_redis.primary_endpoint_address }
output "port" { value = aws_elasticache_replication_group.sidekick_redis.port }
