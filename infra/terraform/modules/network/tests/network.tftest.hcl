mock_provider "aws" {}

variables {
  name       = "playground-local"
  cidr_block = "10.20.0.0/16"
  public_subnets = {
    us-east-1a = "10.20.0.0/24"
    us-east-1b = "10.20.1.0/24"
  }
}

run "public_subnets_only" {
  command = plan

  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_route_table_association.public) == 2
    error_message = "Uma subnet pública por zona, ligadas à route table pública."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.alb_listener["0.0.0.0/0"].from_port == 80
    error_message = "O SG do ALB abre só a porta do listener."
  }

  assert {
    condition     = aws_vpc_security_group_ingress_rule.services_from_alb.from_port == 8080 && aws_vpc_security_group_ingress_rule.services_from_alb.to_port == 32767
    error_message = "Os serviços aceitam do ALB a faixa de container, instância e NodePort."
  }
}

run "rejects_single_az" {
  command = plan

  variables {
    public_subnets = { us-east-1a = "10.20.0.0/24" }
  }

  expect_failures = [var.public_subnets]
}
