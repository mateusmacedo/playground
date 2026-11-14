output "target_group_arn" {
  description = "Target group do estágio ECS, para a regra do serviço no ALB."
  value       = aws_lb_target_group.this.arn
}

output "service_name" {
  description = "Nome do serviço ECS."
  value       = aws_ecs_service.this.name
}

output "task_definition_arn" {
  description = "ARN da revisão da task definition em uso."
  value       = aws_ecs_task_definition.this.arn
}

output "task_role_arn" {
  description = "Role da task, onde entram as permissões do serviço."
  value       = aws_iam_role.task.arn
}

output "image" {
  description = "Imagem que as tasks rodam."
  value       = var.image
}
