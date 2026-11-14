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

module "alb" {
  source = "../../../modules/alb"

  name               = local.name
  subnet_ids         = module.network.public_subnet_ids
  security_group_ids = [module.network.alb_security_group_id]
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
      "platform/alb/http-listener-arn"      = module.alb.http_listener_arn
      "platform/alb/http-listener-port"     = tostring(module.alb.http_listener_port)
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
