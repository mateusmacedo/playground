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
  vpc_id             = "vpc-123"
  subnet_ids         = ["subnet-1", "subnet-2"]
  security_group_ids = ["sg-1"]
  ami_id             = "ami-alpine"
  image              = "000000000000.dkr.ecr.us-east-1.localhost:4566/playground-example-go:sha-abc1234"
  ecr_repository_arn = "arn:aws:ecr:us-east-1:000000000000:repository/playground-example-go"
  registry_alias     = "floci"
}

run "asg_of_one" {
  command = plan

  assert {
    condition     = aws_autoscaling_group.this.desired_capacity == 1 && aws_autoscaling_group.this.max_size == 1
    error_message = "O estágio 1 é um ASG de uma instância."
  }

  assert {
    condition     = aws_lb_target_group.this.target_type == "instance" && aws_lb_target_group.this.health_check[0].matcher == "200-299"
    error_message = "Target group de instância, aceitando qualquer 2xx no health."
  }

  assert {
    condition     = strcontains(base64decode(aws_launch_template.this.user_data), "REGISTRY_ALIAS='floci'")
    error_message = "O user data recebe o alias do registry do Floci."
  }

  assert {
    condition     = aws_launch_template.this.metadata_options[0].http_tokens == "required"
    error_message = "A instância exige IMDSv2."
  }
}
