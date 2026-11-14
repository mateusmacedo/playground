mock_provider "aws" {
  override_data {
    target = data.aws_region.current
    values = { region = "us-east-1" }
  }

  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
}

variables {
  name               = "example-go"
  cluster_arn        = "arn:aws:ecs:us-east-1:111122223333:cluster/playground-local"
  vpc_id             = "vpc-123"
  subnet_ids         = ["subnet-1", "subnet-2"]
  security_group_ids = ["sg-1"]
  image              = "111122223333.dkr.ecr.us-east-1.amazonaws.com/playground-example-go:sha-abc1234"
  ecr_repository_arn = "arn:aws:ecr:us-east-1:111122223333:repository/playground-example-go"
}

run "fargate_with_logs" {
  command = plan

  assert {
    condition     = aws_ecs_task_definition.this.network_mode == "awsvpc" && contains(aws_ecs_task_definition.this.requires_compatibilities, "FARGATE")
    error_message = "A task é Fargate com awsvpc."
  }

  assert {
    condition     = !aws_ecs_service.this.network_configuration[0].assign_public_ip
    error_message = "Sem pedir, as tasks ficam sem IP público."
  }

  assert {
    condition     = aws_cloudwatch_log_group.this.name == "/ecs/example-go"
    error_message = "O log group é /ecs/<serviço>."
  }

  assert {
    condition     = aws_lb_target_group.this.target_type == "ip"
    error_message = "O ECS registra IPs no target group."
  }

  assert {
    condition     = strcontains(aws_ecs_task_definition.this.container_definitions, "\"PORT\"")
    error_message = "O container recebe PORT."
  }
}
