data "aws_elb_service_account" "this" {}

locals {
  # NOTE: `alb` recebe os access logs do ALB; `s3` recebe o registro de acesso
  # (server access logging) do bucket `alb`. Os dois têm as mesmas proteções.
  log_buckets = {
    alb = "${var.name}-alb-access-logs"
    s3  = "${var.name}-s3-access-logs"
  }
}

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  internal           = false
  subnets            = var.subnet_ids
  security_groups    = var.security_group_ids

  drop_invalid_header_fields = true

  # WHY: o registro de cada requisição é a trilha de auditoria do tráfego que
  # entra pela borda (ADR 0014).
  access_logs {
    bucket  = aws_s3_bucket.logs["alb"].id
    prefix  = var.name
    enabled = true
  }

  tags = merge(var.tags, { Name = var.name })

  depends_on = [aws_s3_bucket_policy.logs]
}

# WHY: o listener nasce com 404 padrão; cada serviço (L4) acrescenta as próprias
# regras com prioridade da faixa reservada, sem tocar na plataforma (L1).
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = var.https_port
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = jsonencode({ message = "Not Found" })
      status_code  = "404"
    }
  }

  tags = var.tags
}

# WHY: o listener HTTP virou redirecionamento; o `moved` atualiza o mesmo
# listener no lugar em vez de criar outro na porta 80 antes de apagar o antigo.
moved {
  from = aws_lb_listener.http
  to   = aws_lb_listener.http_redirect
}

# NOTE: a porta HTTP só existe para mandar o cliente ao HTTPS; nenhuma regra de
# serviço fica nela.
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = var.http_port
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = tostring(var.https_port)
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = var.tags
}

resource "aws_s3_bucket" "logs" {
  for_each = local.log_buckets

  bucket        = each.value
  force_destroy = var.access_logs_force_destroy

  tags = merge(var.tags, { Name = each.value })
}

# WHY: quem lê ou apaga os access logs também fica registrado; o destino é um
# bucket próprio para o registro não gerar registro de si mesmo.
resource "aws_s3_bucket_logging" "alb" {
  bucket        = aws_s3_bucket.logs["alb"].id
  target_bucket = aws_s3_bucket.logs["s3"].id
  target_prefix = "${local.log_buckets.alb}/"

  depends_on = [aws_s3_bucket_policy.logs]
}

resource "aws_s3_bucket_public_access_block" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# NOTE: o access log do ALB só aceita SSE-S3 no bucket de destino.
resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id

  rule {
    id     = "expire-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.access_logs_retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.access_logs_retention_days
    }
  }

  depends_on = [aws_s3_bucket_versioning.logs]
}

locals {
  log_writers = {
    alb = {
      sid        = "AllowAlbLogDelivery"
      type       = "AWS"
      identifier = data.aws_elb_service_account.this.arn
      resource   = "${aws_s3_bucket.logs["alb"].arn}/${var.name}/AWSLogs/*"
      source_arn = null
    }
    s3 = {
      sid        = "AllowS3ServerAccessLogDelivery"
      type       = "Service"
      identifier = "logging.s3.amazonaws.com"
      resource   = "${aws_s3_bucket.logs["s3"].arn}/*"
      source_arn = aws_s3_bucket.logs["alb"].arn
    }
  }
}

data "aws_iam_policy_document" "logs" {
  for_each = local.log_writers

  statement {
    sid       = each.value.sid
    actions   = ["s3:PutObject"]
    resources = [each.value.resource]

    principals {
      type        = each.value.type
      identifiers = [each.value.identifier]
    }

    dynamic "condition" {
      for_each = each.value.source_arn == null ? [] : [each.value.source_arn]

      content {
        test     = "ArnLike"
        variable = "aws:SourceArn"
        values   = [condition.value]
      }
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.logs[each.key].arn,
      "${aws_s3_bucket.logs[each.key].arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "logs" {
  for_each = aws_s3_bucket.logs

  bucket = each.value.id
  policy = data.aws_iam_policy_document.logs[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.logs]
}
