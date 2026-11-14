resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  internal           = false
  subnets            = var.subnet_ids
  security_groups    = var.security_group_ids

  drop_invalid_header_fields = true

  tags = merge(var.tags, { Name = var.name })
}

# WHY: o listener nasce com 404 padrão; cada serviço (L4) acrescenta as próprias
# regras com prioridade da faixa reservada, sem tocar na plataforma (L1).
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = var.http_port
  protocol          = "HTTP"

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
