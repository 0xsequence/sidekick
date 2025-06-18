resource "aws_elasticache_replication_group" "sidekick_redis" {
  replication_group_id       = var.elastic_cache_id
  description                = "Redis cluster for Sequence Sidekick"
  engine                     = var.elastic_cache_engine
  engine_version             = var.elastic_cache_version
  node_type                  = var.elastic_cache_node_type
  port                       = var.elastic_cache_port
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = var.elastic_cache_failover_enabled
  at_rest_encryption_enabled = var.elastic_cache_rest_encryption_enabled
  transit_encryption_enabled = var.elastic_cache_transit_encryption_Enabled

  subnet_group_name  = var.elastic_cache_sg
  security_group_ids = [var.elastic_cache_security_group]

  num_node_groups         = var.elastic_cache_num_nodes
  replicas_per_node_group = var.elastic_cache_replicas_node

  apply_immediately = false
}
