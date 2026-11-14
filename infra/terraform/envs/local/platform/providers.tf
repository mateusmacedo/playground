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
    ec2            = var.endpoint
    ecr            = var.endpoint
    ecs            = var.endpoint
    eks            = var.endpoint
    elbv2          = var.endpoint
    iam            = var.endpoint
    secretsmanager = var.endpoint
    ssm            = var.endpoint
    sts            = var.endpoint
  }

  default_tags {
    tags = local.tags
  }
}
