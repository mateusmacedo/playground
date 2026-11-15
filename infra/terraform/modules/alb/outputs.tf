output "arn" {
  description = "ARN do ALB."
  value       = aws_lb.this.arn
}

output "dns_name" {
  description = "DNS do ALB."
  value       = aws_lb.this.dns_name
}

output "https_listener_arn" {
  description = "ARN do listener HTTPS, onde os serviços penduram as regras."
  value       = aws_lb_listener.https.arn
}

output "https_listener_port" {
  description = "Porta do listener HTTPS."
  value       = aws_lb_listener.https.port
}

output "access_logs_bucket" {
  description = "Bucket S3 que recebe os access logs do ALB."
  value       = aws_s3_bucket.logs["alb"].id
}

output "server_access_logs_bucket" {
  description = "Bucket S3 que recebe o registro de acesso do bucket dos access logs."
  value       = aws_s3_bucket.logs["s3"].id
}
