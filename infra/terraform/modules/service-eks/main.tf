locals {
  resource_name = "${var.name}-eks"
  labels = {
    "app.kubernetes.io/name"       = var.name
    "app.kubernetes.io/managed-by" = "terraform"
  }
  environment = merge(var.environment, { PORT = tostring(var.container_port) })
}

resource "kubernetes_namespace_v1" "this" {
  metadata {
    name   = var.name
    labels = local.labels
  }
}

resource "kubernetes_deployment_v1" "this" {
  metadata {
    name      = var.name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.labels
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = { "app.kubernetes.io/name" = var.name }
    }

    template {
      metadata {
        labels = local.labels
      }

      spec {
        termination_grace_period_seconds = 30

        container {
          name  = var.name
          image = var.image

          port {
            container_port = var.container_port
          }

          dynamic "env" {
            for_each = local.environment

            content {
              name  = env.key
              value = env.value
            }
          }

          readiness_probe {
            http_get {
              path = var.health_check_path
              port = var.container_port
            }
            period_seconds = 5
          }

          liveness_probe {
            http_get {
              path = var.health_check_path
              port = var.container_port
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }

          resources {
            requests = {
              cpu    = var.resources.cpu_request
              memory = var.resources.memory_request
            }
            limits = {
              memory = var.resources.memory_limit
            }
          }
        }
      }
    }
  }

  timeouts {
    create = "5m"
    update = "5m"
  }
}

# WHY: NodePort com os nós como alvo no target group do ALB compartilhado faz o
# papel do AWS Load Balancer Controller, que não roda no Floci; o roteamento
# segue na regra ponderada do ALB, que faz o blue/green entre estágios.
resource "kubernetes_service_v1" "this" {
  metadata {
    name      = var.name
    namespace = kubernetes_namespace_v1.this.metadata[0].name
    labels    = local.labels
  }

  spec {
    type     = "NodePort"
    selector = { "app.kubernetes.io/name" = var.name }

    port {
      name        = "http"
      port        = var.container_port
      target_port = var.container_port
      node_port   = var.node_port
    }
  }
}

data "kubernetes_nodes" "this" {}

locals {
  # NOTE: o providerID do nó (aws:///<zona>/i-...) dá a instância EC2 do nó,
  # tanto na AWS quanto no Floci, que registra o k3s como instância.
  node_instance_ids = toset([
    for node in data.kubernetes_nodes.this.nodes :
    regex("i-[0-9a-f]+", node.spec[0].provider_id)
    if can(regex("i-[0-9a-f]+", node.spec[0].provider_id))
  ])
}

data "aws_instance" "node" {
  for_each = local.node_instance_ids

  instance_id = each.key
}

# WORKAROUND(floci-2.4.0): com alvo do tipo instance, o health check do Floci
# não alcança o nó k3s, embora a NodePort responda no IP privado da instância;
# o alvo ip com esse endereço funciona e, na AWS, equivale ao modo instance.
resource "aws_lb_target_group" "this" {
  name                 = local.resource_name
  vpc_id               = var.vpc_id
  target_type          = "ip"
  protocol             = "HTTP"
  port                 = var.node_port
  deregistration_delay = var.deregistration_delay

  health_check {
    path                = var.health_check_path
    matcher             = "200-299"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { stage = "eks" })
}

resource "aws_lb_target_group_attachment" "nodes" {
  for_each = local.node_instance_ids

  target_group_arn = aws_lb_target_group.this.arn
  target_id        = data.aws_instance.node[each.key].private_ip
  port             = var.node_port

  depends_on = [kubernetes_service_v1.this]
}
