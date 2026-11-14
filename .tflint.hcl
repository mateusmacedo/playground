# Configuração do tflint dos projetos `infra-local-*` (o target `lint` passa
# este arquivo com --config).
# NOTE: a versão do plugin aws é fixada aqui e mantida pelo Renovate; o ruleset
# `terraform` vem embutido no binário do tflint.

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

plugin "aws" {
  enabled = true
  version = "0.50.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}
