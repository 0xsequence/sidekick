
output "web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.sidekick.arn
}

output "web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.sidekick.id
}

output "association_ids" {
  description = "IDs of the WAF associations"
  value       = aws_wafv2_web_acl_association.sidekick_associations[*].id
}