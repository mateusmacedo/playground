# WHY: credenciais fixas e endpoint validado como loopback impedem que este env
# alcance uma conta AWS real, mesmo com credenciais reais no ambiente do shell.
provider "aws" {
  region     = var.region
  access_key = "test"
  secret_key = "test"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    autoscaling    = var.endpoint
    ec2            = var.endpoint
    ecs            = var.endpoint
    eks            = var.endpoint
    elbv2          = var.endpoint
    iam            = var.endpoint
    logs           = var.endpoint
    secretsmanager = var.endpoint
    ssm            = var.endpoint
    sts            = var.endpoint
  }

  default_tags {
    tags = local.tags
  }
}

# WORKAROUND(floci-2.4.0): só assina o token do EKS. O Floci recusa test/test
# no webhook do k3s, então usa a chave local que a plataforma guardou no
# Secrets Manager.
provider "aws" {
  alias = "eks_auth"

  region     = var.region
  access_key = try(local.eks_deployer.access_key_id, "test")
  secret_key = try(local.eks_deployer.secret_access_key, "test")

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    eks = var.endpoint
    sts = var.endpoint
  }
}

provider "kubernetes" {
  host                   = try(data.aws_eks_cluster.this[0].endpoint, null)
  cluster_ca_certificate = try(base64decode(data.aws_eks_cluster.this[0].certificate_authority[0].data), null)
  token                  = try(data.aws_eks_cluster_auth.this[0].token, null)
}
