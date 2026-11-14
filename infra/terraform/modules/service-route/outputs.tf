output "rule_arns" {
  description = "ARNs das regras criadas (host e path)."
  value       = { for kind, rule in aws_lb_listener_rule.this : kind => rule.arn }
}

output "weights" {
  description = "Peso efetivo por estágio."
  value       = { for stage, tg in var.target_groups : stage => tg.weight }
}
