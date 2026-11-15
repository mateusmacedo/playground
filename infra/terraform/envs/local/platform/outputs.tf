output "ssm_parameters" {
  description = "Parâmetros publicados no SSM (chave => nome completo)."
  value       = module.contract.names
}

output "alb_dns_name" {
  description = "DNS do ALB compartilhado."
  value       = module.alb.dns_name
}

output "alb_certificate_pem" {
  description = "Certificado público (PEM) do listener HTTPS, para o cliente local confiar nele."
  value       = tls_self_signed_cert.alb.cert_pem
}

output "ecr_repositories" {
  description = "Repositórios ECR por nome."
  value       = module.ecr.repositories
}

output "eks_cluster_name" {
  description = "Nome do cluster EKS, quando o estágio 3 está ligado."
  value       = try(aws_eks_cluster.this[0].name, null)
}
