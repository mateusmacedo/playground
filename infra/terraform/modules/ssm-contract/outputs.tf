output "prefix" {
  description = "Prefixo canônico /<app>/<stage>/<região>."
  value       = local.prefix
}

output "names" {
  description = "Nome completo de cada parâmetro publicado, por chave."
  value       = { for key, param in aws_ssm_parameter.this : key => param.name }
}
