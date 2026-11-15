mock_provider "aws" {
  mock_data "aws_elb_service_account" {
    defaults = {
      arn = "arn:aws:iam::127311923021:root"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  name               = "playground-local"
  subnet_ids         = ["subnet-1", "subnet-2"]
  security_group_ids = ["sg-1"]
  certificate_arn    = "arn:aws:acm:us-east-1:000000000000:certificate/test"
}

run "https_with_404_default" {
  command = plan

  assert {
    condition     = aws_lb_listener.https.port == 443 && aws_lb_listener.https.protocol == "HTTPS"
    error_message = "O listener dos serviços é HTTPS na 443."
  }

  assert {
    condition     = aws_lb_listener.https.ssl_policy == "ELBSecurityPolicy-TLS13-1-2-2021-06"
    error_message = "O listener HTTPS usa a política de TLS 1.3 e 1.2."
  }

  assert {
    condition     = aws_lb_listener.https.default_action[0].fixed_response[0].status_code == "404"
    error_message = "Sem regra, o listener responde 404."
  }

  assert {
    condition     = aws_lb.this.drop_invalid_header_fields
    error_message = "O ALB descarta cabeçalhos inválidos."
  }
}

run "http_only_redirects_to_https" {
  command = plan

  assert {
    condition     = aws_lb_listener.http_redirect.port == 80 && aws_lb_listener.http_redirect.protocol == "HTTP"
    error_message = "A porta HTTP é a 80."
  }

  assert {
    condition = (
      aws_lb_listener.http_redirect.default_action[0].type == "redirect" &&
      aws_lb_listener.http_redirect.default_action[0].redirect[0].protocol == "HTTPS" &&
      aws_lb_listener.http_redirect.default_action[0].redirect[0].port == "443" &&
      aws_lb_listener.http_redirect.default_action[0].redirect[0].status_code == "HTTP_301"
    )
    error_message = "A porta HTTP só redireciona para o HTTPS com 301."
  }
}

run "access_logs_in_protected_bucket" {
  command = plan

  assert {
    condition     = aws_lb.this.access_logs[0].enabled && aws_lb.this.access_logs[0].prefix == "playground-local"
    error_message = "O ALB grava os access logs com o próprio nome como prefixo."
  }

  assert {
    condition     = aws_s3_bucket.alb_access_logs.bucket == "playground-local-alb-access-logs" && aws_s3_bucket.s3_access_logs.bucket == "playground-local-s3-access-logs"
    error_message = "Um bucket recebe os access logs do ALB e outro, o registro de acesso dele."
  }

  assert {
    condition     = aws_s3_bucket_logging.alb_access_logs.target_prefix == "playground-local-alb-access-logs/"
    error_message = "O bucket dos access logs registra os próprios acessos no bucket s3."
  }

  assert {
    condition = alltrue([
      for block in values(aws_s3_bucket_public_access_block.logs) :
      block.block_public_acls && block.block_public_policy && block.ignore_public_acls && block.restrict_public_buckets
    ])
    error_message = "Os dois buckets de log bloqueiam todo acesso público."
  }

  assert {
    condition = alltrue([
      for config in values(aws_s3_bucket_server_side_encryption_configuration.logs) :
      one(one(config.rule).apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    ])
    error_message = "Os dois buckets de log criptografam com SSE-S3, o único aceito pelo ALB."
  }

  assert {
    condition = alltrue([
      for versioning in values(aws_s3_bucket_versioning.logs) :
      versioning.versioning_configuration[0].status == "Enabled"
    ])
    error_message = "Os dois buckets de log são versionados."
  }

  assert {
    condition     = !aws_s3_bucket.alb_access_logs.force_destroy && !aws_s3_bucket.s3_access_logs.force_destroy
    error_message = "Por padrão os buckets de log não são apagados com objetos dentro."
  }
}

run "rejects_long_name" {
  command = plan

  variables {
    name = "playground-local-with-a-very-long-name"
  }

  expect_failures = [var.name]
}

run "rejects_zero_retention" {
  command = plan

  variables {
    access_logs_retention_days = 0
  }

  expect_failures = [var.access_logs_retention_days]
}
