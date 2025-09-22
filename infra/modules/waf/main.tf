resource "aws_wafv2_web_acl" "sidekick" {
  name  = var.waf_name
  scope = var.waf_scope

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "sidekick-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Name      = "SidekickWAF"
    Env       = "Infra"
    AWSRegion = "us-west-2"
    Owner     = "DevGameServices"
    Role      = "WAF"
  }
}

# Multiple WAF associations - one for each ALB
resource "aws_wafv2_web_acl_association" "sidekick_associations" {
  count = length(var.waf_association_lb_arns)

  resource_arn = var.waf_association_lb_arns[count.index]
  web_acl_arn  = aws_wafv2_web_acl.sidekick.arn
}