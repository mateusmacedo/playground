data "aws_elb_service_account" "this" {}

locals {
  alb_logs_bucket_name = "${var.name}-alb-access-logs"
  s3_logs_bucket_name  = "${var.name}-s3-access-logs"

  # NOTE: os dois buckets de log recebem as mesmas proteções; as políticas e
  # os buckets ficam explícitos para cada um declarar quem pode gravar nele.
  log_bucket_ids = {
    alb = aws_s3_bucket.alb_access_logs.id
    s3  = aws_s3_bucket.s3_access_logs.id
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
    bucket  = aws_s3_bucket.alb_access_logs.id
    prefix  = var.name
    enabled = true
  }

  tags = merge(var.tags, { Name = var.name })

  depends_on = [aws_s3_bucket_policy.alb_access_logs]
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

resource "aws_s3_bucket" "alb_access_logs" {
  bucket        = local.alb_logs_bucket_name
  force_destroy = var.access_logs_force_destroy

  tags = merge(var.tags, { Name = local.alb_logs_bucket_name })
}

resource "aws_s3_bucket" "s3_access_logs" {
  bucket        = local.s3_logs_bucket_name
  force_destroy = var.access_logs_force_destroy

  tags = merge(var.tags, { Name = local.s3_logs_bucket_name })
}

# WHY: quem lê ou apaga os access logs também fica registrado; o destino é um
# bucket próprio para o registro não gerar registro de si mesmo.
resource "aws_s3_bucket_logging" "alb_access_logs" {
  bucket        = aws_s3_bucket.alb_access_logs.id
  target_bucket = aws_s3_bucket.s3_access_logs.id
  target_prefix = "${local.alb_logs_bucket_name}/"

  depends_on = [aws_s3_bucket_policy.s3_access_logs]
}

resource "aws_s3_bucket_public_access_block" "logs" {
  for_each = local.log_bucket_ids

  bucket = each.value

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  for_each = local.log_bucket_ids

  bucket = each.value

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# NOTE: o access log do ALB só aceita SSE-S3 no bucket de destino.
resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  for_each = local.log_bucket_ids

  bucket = each.value

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  for_each = local.log_bucket_ids

  bucket = each.value

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  for_each = local.log_bucket_ids

  bucket = each.value

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

data "aws_iam_policy_document" "alb_access_logs" {
  statement {
    sid       = "AllowAlbLogDelivery"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.alb_access_logs.arn}/${var.name}/AWSLogs/*"]

    principals {
      type        = "AWS"
      identifiers = [data.aws_elb_service_account.this.arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.alb_access_logs.arn,
      "${aws_s3_bucket.alb_access_logs.arn}/*",
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

resource "aws_s3_bucket_policy" "alb_access_logs" {
  bucket = aws_s3_bucket.alb_access_logs.id
  policy = data.aws_iam_policy_document.alb_access_logs.json

  depends_on = [aws_s3_bucket_public_access_block.logs]
}

data "aws_iam_policy_document" "s3_access_logs" {
  statement {
    sid       = "AllowS3ServerAccessLogDelivery"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.s3_access_logs.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["logging.s3.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.alb_access_logs.arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.s3_access_logs.arn,
      "${aws_s3_bucket.s3_access_logs.arn}/*",
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

resource "aws_s3_bucket_policy" "s3_access_logs" {
  bucket = aws_s3_bucket.s3_access_logs.id
  policy = data.aws_iam_policy_document.s3_access_logs.json

  depends_on = [aws_s3_bucket_public_access_block.logs]
}
