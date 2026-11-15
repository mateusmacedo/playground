mock_provider "aws" {}

variables {
  stage  = "dev"
  region = "us-east-1"
  layer  = "L1"
  parameters = {
    "platform/vpc/id" = "vpc-123"
  }
}

run "canonical_path" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.this["platform/vpc/id"].name == "/playground/dev/us-east-1/platform/vpc/id"
    error_message = "O nome segue /<app>/<stage>/<região>/<domínio>/<recurso>/<atributo>."
  }

  assert {
    condition     = aws_ssm_parameter.this["platform/vpc/id"].type == "String"
    error_message = "O contrato só publica String, nunca segredo."
  }
}

run "rejects_bad_key" {
  command = plan

  variables {
    parameters = { "platform/vpc" = "vpc-123" }
  }

  expect_failures = [var.parameters]
}
