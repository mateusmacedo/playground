output "target_group_arn" {
  description = "Target group do estágio EKS, para a regra do serviço no ALB."
  value       = aws_lb_target_group.this.arn
}

output "namespace" {
  description = "Namespace do serviço no cluster."
  value       = kubernetes_namespace_v1.this.metadata[0].name
}

output "node_targets" {
  description = "Instâncias dos nós registradas no target group."
  value       = local.node_instance_ids
}

output "image" {
  description = "Imagem que o deployment roda."
  value       = var.image
}
