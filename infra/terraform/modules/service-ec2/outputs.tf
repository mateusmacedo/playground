output "target_group_arn" {
  description = "Target group do estágio EC2, para a regra do serviço no ALB."
  value       = aws_lb_target_group.this.arn
}

output "autoscaling_group_name" {
  description = "Nome do Auto Scaling group."
  value       = aws_autoscaling_group.this.name
}

output "launch_template_version" {
  description = "Versão do launch template em uso."
  value       = aws_launch_template.this.latest_version
}

output "image" {
  description = "Imagem que a instância roda."
  value       = var.image
}
