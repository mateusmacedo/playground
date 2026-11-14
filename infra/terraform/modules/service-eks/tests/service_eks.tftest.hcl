mock_provider "aws" {}

mock_provider "kubernetes" {
  mock_data "kubernetes_nodes" {
    defaults = { nodes = [] }
  }
}

variables {
  name      = "example-go"
  vpc_id    = "vpc-123"
  image     = "000000000000.dkr.ecr.us-east-1.localhost:4566/playground-example-go:sha-abc1234"
  node_port = 30100
}

run "nodeport_behind_alb" {
  command = plan

  assert {
    condition     = kubernetes_service_v1.this.spec[0].type == "NodePort" && kubernetes_service_v1.this.spec[0].port[0].node_port == 30100
    error_message = "O service expõe a NodePort da faixa reservada."
  }

  assert {
    condition     = aws_lb_target_group.this.target_type == "ip" && aws_lb_target_group.this.port == 30100
    error_message = "O target group aponta para os nós na NodePort, por IP (contorno do Floci 2.4.0)."
  }

  assert {
    condition     = kubernetes_deployment_v1.this.spec[0].template[0].spec[0].container[0].readiness_probe[0].http_get[0].path == "/health"
    error_message = "A readiness usa o health do contrato."
  }
}

run "rejects_out_of_range_nodeport" {
  command = plan

  variables {
    node_port = 8080
  }

  expect_failures = [var.node_port]
}
