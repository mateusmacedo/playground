locals {
  prefix = "/${var.app}/${var.stage}/${var.region}"
}

# NOTE: String sem criptografia: o contrato carrega só identificadores (ARN,
# URL, nome). Segredo vai para o Secrets Manager e aqui entra apenas o ARN dele.
resource "aws_ssm_parameter" "this" {
  for_each = var.parameters

  name        = "${local.prefix}/${each.key}"
  description = "Published by Terraform (${var.layer})"
  type        = "String"
  value       = each.value

  tags = merge(var.tags, { layer = var.layer })
}
