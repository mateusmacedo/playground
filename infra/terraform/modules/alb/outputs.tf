output "arn" {
  description = "ARN do ALB."
  value       = aws_lb.this.arn
}

output "dns_name" {
  description = "DNS do ALB."
  value       = aws_lb.this.dns_name
}

output "http_listener_arn" {
  description = "ARN do listener HTTP, onde os serviços penduram as regras."
  value       = aws_lb_listener.http.arn
}

output "http_listener_port" {
  description = "Porta do listener HTTP."
  value       = aws_lb_listener.http.port
}
