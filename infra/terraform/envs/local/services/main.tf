locals {
  tags = {
    app        = "playground"
    stage      = "local"
    layer      = "services"
    managed-by = "terraform"
  }

  ssm_prefix = "/playground/local/${var.region}"

  stages_in_use = toset(flatten([for svc in values(var.services) : keys(svc.stages)]))

  required_parameters = toset(concat(
    [
      "platform/vpc/id",
      "platform/public-subnets/ids",
      "platform/alb/https-listener-arn",
      "platform/alb/https-listener-port",
      "platform/services-security-group/id",
    ],
    contains(local.stages_in_use, "ecs") ? ["platform/ecs-cluster/arn"] : [],
    contains(local.stages_in_use, "eks") ? ["platform/eks-cluster/name", "platform/eks-deployer/secret-arn"] : [],
    flatten([
      for name in keys(var.services) : ["${name}/ecr-repository/url", "${name}/ecr-repository/arn"]
    ]),
  ))
}

# WHY: o SSM é a única interface com a plataforma (ADR 0004 e ADR 0009), e o
# plan falha listando tudo o que falta, em vez de falhar no meio do apply.
data "aws_ssm_parameters_by_path" "contract" {
  path      = local.ssm_prefix
  recursive = true

  lifecycle {
    postcondition {
      condition = length(setsubtract(
        local.required_parameters,
        [for name in self.names : trimprefix(name, "${local.ssm_prefix}/")],
      )) == 0
      error_message = format(
        "Contrato SSM incompleto em %s. Faltam: %s. Aplique o infra-local-platform (com TF_VAR_enable_eks=true para o estágio eks).",
        local.ssm_prefix,
        join(", ", sort(setsubtract(
          local.required_parameters,
          [for name in self.names : trimprefix(name, "${local.ssm_prefix}/")],
        ))),
      )
    }
  }
}

# WHY: a tag sai da mesma regra do push (tools/container/image-tag.sh), então o
# apply roda sem argumento e nunca pede ao ECR uma tag que o docker:push-floci
# não publicou.
data "external" "image_tag" {
  count = var.image_tag == null ? 1 : 0

  program = [
    "bash", "-c", "printf '{\"tag\":\"%s\"}' \"$(bash \"$0\")\"",
    "${abspath(path.root)}/../../../../../tools/container/image-tag.sh",
  ]
}

locals {
  # NOTE: o provider marca values como sensível por cobrir SecureString; o
  # contrato só tem String com identificadores.
  contract_values = nonsensitive(data.aws_ssm_parameters_by_path.contract.values)

  contract = {
    for index, name in data.aws_ssm_parameters_by_path.contract.names :
    trimprefix(name, "${local.ssm_prefix}/") => local.contract_values[index]
  }

  platform = {
    vpc_id                     = local.contract["platform/vpc/id"]
    subnet_ids                 = split(",", local.contract["platform/public-subnets/ids"])
    listener_arn               = local.contract["platform/alb/https-listener-arn"]
    listener_port              = tonumber(local.contract["platform/alb/https-listener-port"])
    services_security_group_id = local.contract["platform/services-security-group/id"]
    ecs_cluster_arn            = lookup(local.contract, "platform/ecs-cluster/arn", null)
  }

  image_tag = coalesce(var.image_tag, try(data.external.image_tag[0].result.tag, null))

  services = {
    for name, svc in var.services : name => merge(svc, {
      image              = "${local.contract["${name}/ecr-repository/url"]}:${coalesce(svc.image_tag, local.image_tag)}"
      ecr_repository_arn = local.contract["${name}/ecr-repository/arn"]
      host               = "${name}.${var.domain_name}"
    })
  }

  ec2_services = { for name, svc in local.services : name => svc if contains(keys(svc.stages), "ec2") }
  ecs_services = { for name, svc in local.services : name => svc if contains(keys(svc.stages), "ecs") }
  eks_services = { for name, svc in local.services : name => svc if contains(keys(svc.stages), "eks") }
}

module "ec2" {
  source   = "../../../modules/service-ec2"
  for_each = local.ec2_services

  name               = each.key
  vpc_id             = local.platform.vpc_id
  subnet_ids         = local.platform.subnet_ids
  security_group_ids = [local.platform.services_security_group_id]
  ami_id             = var.ec2_ami_id
  image              = each.value.image
  ecr_repository_arn = each.value.ecr_repository_arn
  container_port     = each.value.port
  health_check_path  = each.value.health_check_path
  environment        = each.value.environment
  registry_alias     = var.ec2_registry_alias
  # NOTE: o ASG não herda o default_tags do provider.
  tags = local.tags
}

module "ecs" {
  source   = "../../../modules/service-ecs"
  for_each = local.ecs_services

  name               = each.key
  cluster_arn        = local.platform.ecs_cluster_arn
  vpc_id             = local.platform.vpc_id
  subnet_ids         = local.platform.subnet_ids
  security_group_ids = [local.platform.services_security_group_id]
  assign_public_ip   = true
  image              = each.value.image
  ecr_repository_arn = each.value.ecr_repository_arn
  container_port     = each.value.port
  health_check_path  = each.value.health_check_path
  environment        = each.value.environment
  cpu                = each.value.cpu
  memory             = each.value.memory
  log_retention_days = 7
}

module "eks" {
  source   = "../../../modules/service-eks"
  for_each = local.eks_services

  name              = each.key
  vpc_id            = local.platform.vpc_id
  image             = each.value.image
  container_port    = each.value.port
  node_port         = each.value.node_port
  health_check_path = each.value.health_check_path
  environment       = each.value.environment
}

module "route" {
  source   = "../../../modules/service-route"
  for_each = local.services

  listener_arn  = local.platform.listener_arn
  priority      = each.value.priority
  host_headers  = [each.value.host]
  path_patterns = ["/${each.key}", "/${each.key}/*"]

  # WORKAROUND(floci-2.4.0): o ModifyRule não libera o target group retirado;
  # a regra é recriada quando um estágio entra ou sai do roteamento.
  replace_on_target_group_change = true

  # WHY: peso 0 deixa o estágio implantado mas fora da regra. Assim o target
  # group sai da regra num apply e o estágio é destruído no seguinte, sem o
  # ResourceInUse de apagar um target group que a regra ainda referencia.
  target_groups = {
    for stage, tg in merge(
      contains(keys(each.value.stages), "ec2") ? {
        ec2 = { arn = module.ec2[each.key].target_group_arn, weight = each.value.stages.ec2 }
      } : {},
      contains(keys(each.value.stages), "ecs") ? {
        ecs = { arn = module.ecs[each.key].target_group_arn, weight = each.value.stages.ecs }
      } : {},
      contains(keys(each.value.stages), "eks") ? {
        eks = { arn = module.eks[each.key].target_group_arn, weight = each.value.stages.eks }
      } : {},
    ) : stage => tg if tg.weight > 0
  }
}
