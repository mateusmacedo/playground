# Provider kubernetes do estágio eks: o cluster e a chave do deployer vêm do
# contrato SSM da plataforma.
locals {
  eks_in_use = contains(local.stages_in_use, "eks")
}

data "aws_eks_cluster" "this" {
  count = local.eks_in_use ? 1 : 0

  name = local.contract["platform/eks-cluster/name"]
}

data "aws_secretsmanager_secret_version" "eks_deployer" {
  count = local.eks_in_use ? 1 : 0

  secret_id = local.contract["platform/eks-deployer/secret-arn"]
}

locals {
  eks_deployer = try(jsondecode(data.aws_secretsmanager_secret_version.eks_deployer[0].secret_string), null)
}

data "aws_eks_cluster_auth" "this" {
  provider = aws.eks_auth
  count    = length(data.aws_eks_cluster.this)

  name = data.aws_eks_cluster.this[0].name
}
