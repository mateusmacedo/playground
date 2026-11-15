mock_provider "aws" {}

variables {
  name               = "playground-local"
  subnet_ids         = ["subnet-1", "subnet-2"]
  security_group_ids = ["sg-1"]
}

run "http_with_404_default" {
  command = plan

  assert {
    condition     = aws_lb_listener.http.port == 80 && aws_lb_listener.http.protocol == "HTTP"
    error_message = "O listener é HTTP na 80."
  }

  assert {
    condition     = aws_lb_listener.http.default_action[0].fixed_response[0].status_code == "404"
    error_message = "Sem regra, o listener responde 404."
  }

  assert {
    condition     = aws_lb.this.drop_invalid_header_fields
    error_message = "O ALB descarta cabeçalhos inválidos."
  }
}

run "rejects_long_name" {
  command = plan

  variables {
    name = "playground-local-with-a-very-long-name"
  }

  expect_failures = [var.name]
}
