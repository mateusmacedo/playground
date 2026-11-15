locals {
  name = "playground-local"

  tags = {
    app        = "playground"
    stage      = "local"
    layer      = "platform"
    managed-by = "terraform"
  }
}

module "network" {
  source = "../../../modules/network"

  name           = local.name
  cidr_block     = var.vpc_cidr
  public_subnets = var.public_subnets
}

module "ecr" {
  source = "../../../modules/ecr"

  repositories = toset([for svc in var.container_services : "playground-${svc}"])
  force_delete = true
}

# NOTE: sem domínio no ambiente local, o certificado é autoassinado para
# `localhost` e importado no ACM do Floci; numa conta real ele vem do ACM com
# validação por DNS. O smoke confia nele pela chave pública (output).
resource "tls_private_key" "alb" {
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_self_signed_cert" "alb" {
  private_key_pem       = tls_private_key.alb.private_key_pem
  dns_names             = ["localhost"]
  validity_period_hours = 24 * 365
  early_renewal_hours   = 24 * 30
  allowed_uses          = ["digital_signature", "key_encipherment", "server_auth"]

  subject {
    common_name  = "localhost"
    organization = "playground"
  }
}

resource "aws_acm_certificate" "alb" {
  private_key      = tls_private_key.alb.private_key_pem
  certificate_body = tls_self_signed_cert.alb.cert_pem

  lifecycle {
    create_before_destroy = true
  }
}

module "alb" {
  source = "../../../modules/alb"

  name               = local.name
  subnet_ids         = module.network.public_subnet_ids
  security_group_ids = [module.network.alb_security_group_id]
  certificate_arn    = aws_acm_certificate.alb.arn

  # NOTE: o Floci é descartável; o destroy local precisa levar os logs junto.
  access_logs_force_destroy = true
}

resource "aws_ecs_cluster" "this" {
  name = local.name
}

# NOTE: o contrato da plataforma (L1); o env services lê só daqui (ADR 0004).
module "contract" {
  source = "../../../modules/ssm-contract"

  stage  = "local"
  region = var.region
  layer  = "L1"

  parameters = merge(
    {
      "platform/vpc/id"                     = module.network.vpc_id
      "platform/vpc/cidr"                   = module.network.vpc_cidr_block
      "platform/public-subnets/ids"         = join(",", module.network.public_subnet_ids)
      "platform/alb/arn"                    = module.alb.arn
      "platform/alb/dns-name"               = module.alb.dns_name
      "platform/alb/https-listener-arn"     = module.alb.https_listener_arn
      "platform/alb/https-listener-port"    = tostring(module.alb.https_listener_port)
      "platform/alb-security-group/id"      = module.network.alb_security_group_id
      "platform/services-security-group/id" = module.network.services_security_group_id
      "platform/ecs-cluster/name"           = aws_ecs_cluster.this.name
      "platform/ecs-cluster/arn"            = aws_ecs_cluster.this.arn
    },
    merge([
      for svc in var.container_services : {
        "${svc}/ecr-repository/name" = module.ecr.repositories["playground-${svc}"].name
        "${svc}/ecr-repository/arn"  = module.ecr.repositories["playground-${svc}"].arn
        "${svc}/ecr-repository/url"  = module.ecr.repositories["playground-${svc}"].url
      }
    ]...),
    var.enable_eks ? {
      "platform/eks-cluster/name"        = aws_eks_cluster.this[0].name
      "platform/eks-deployer/secret-arn" = aws_secretsmanager_secret.eks_deployer[0].arn
    } : {},
  )
}
