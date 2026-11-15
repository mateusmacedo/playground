output "vpc_id" {
  description = "ID da VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "CIDR da VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "IDs das subnets públicas, na ordem das zonas."
  value       = [for az in sort(keys(aws_subnet.public)) : aws_subnet.public[az].id]
}

output "alb_security_group_id" {
  description = "Security group do ALB."
  value       = aws_security_group.alb.id
}

output "services_security_group_id" {
  description = "Security group dos serviços de container."
  value       = aws_security_group.services.id
}
