mock_provider "aws" {}

variables {
  listener_arn  = "arn:aws:elasticloadbalancing:us-east-1:111122223333:listener/app/x/1/2"
  priority      = 100
  host_headers  = ["example-go.playground.local"]
  path_patterns = ["/example-go", "/example-go/*"]
  target_groups = {
    ec2 = { arn = "arn:aws:elasticloadbalancing:us-east-1:111122223333:targetgroup/example-go-ec2/1", weight = 50 }
    ecs = { arn = "arn:aws:elasticloadbalancing:us-east-1:111122223333:targetgroup/example-go-ecs/2", weight = 50 }
  }
}

run "weighted_rules" {
  command = plan

  assert {
    condition     = aws_lb_listener_rule.this["host"].priority == 100 && aws_lb_listener_rule.this["path"].priority == 101
    error_message = "Host usa priority e path usa priority + 1."
  }

  assert {
    condition     = length(aws_lb_listener_rule.this["path"].action[0].forward[0].target_group) == 2
    error_message = "A regra encaminha com peso para os dois estágios."
  }

  assert {
    condition     = length(terraform_data.target_group_set.input) == 0
    error_message = "Sem o contorno do Floci, a regra não é recriada ao mudar os target groups."
  }
}

run "floci_workaround" {
  command = plan

  variables {
    host_headers                   = []
    replace_on_target_group_change = true
  }

  assert {
    condition     = !contains(keys(aws_lb_listener_rule.this), "host") && length(terraform_data.target_group_set.input) == 2
    error_message = "Sem host, só a regra de path; com o contorno, o conjunto de target groups vira gatilho."
  }
}

run "rejects_zero_weight_sum" {
  command = plan

  variables {
    target_groups = { ecs = { arn = "arn:aws:elasticloadbalancing:us-east-1:111122223333:targetgroup/example-go-ecs/2", weight = 0 } }
  }

  expect_failures = [var.target_groups]
}
