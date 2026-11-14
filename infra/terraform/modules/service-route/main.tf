# WHY: a regra do serviço fica fora dos módulos de estágio porque o blue/green
# precisa de UMA regra que encaminhe, com peso, para os target groups de dois
# estágios ao mesmo tempo (por exemplo EC2 e ECS durante a migração).
locals {
  rules = merge(
    length(var.host_headers) > 0 ? {
      host = { priority = var.priority, field = "host", values = var.host_headers }
    } : {},
    length(var.path_patterns) > 0 ? {
      path = { priority = var.priority + 1, field = "path", values = var.path_patterns }
    } : {},
  )
}

# WORKAROUND(floci-2.4.0): o ModifyRule do Floci não solta o target group que
# saiu da regra, e o DeleteTargetGroup seguinte falha com ResourceInUse. Recriar
# a regra libera o target group; na AWS a opção fica desligada.
resource "terraform_data" "target_group_set" {
  input = var.replace_on_target_group_change ? sort([for tg in values(var.target_groups) : tg.arn]) : []
}

resource "aws_lb_listener_rule" "this" {
  for_each = local.rules

  listener_arn = var.listener_arn
  priority     = each.value.priority

  lifecycle {
    replace_triggered_by = [terraform_data.target_group_set]
  }

  action {
    type = "forward"

    forward {
      dynamic "target_group" {
        for_each = var.target_groups

        content {
          arn    = target_group.value.arn
          weight = target_group.value.weight
        }
      }
    }
  }

  dynamic "condition" {
    for_each = each.value.field == "host" ? [each.value.values] : []

    content {
      host_header {
        values = condition.value
      }
    }
  }

  dynamic "condition" {
    for_each = each.value.field == "path" ? [each.value.values] : []

    content {
      path_pattern {
        values = condition.value
      }
    }
  }

  tags = var.tags
}
