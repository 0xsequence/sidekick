output "lb_target_group_arn" { value = aws_lb_target_group.sidekick_tg.arn }
output "lb_target_group_internal_arn" { value = aws_lb_target_group.sidekick_tg_internal.arn }
output "alb_arn" { value = aws_lb.sidekick_alb.arn }
output "alb_internal_arn" { value = aws_lb.sidekick_alb_internal.arn }
