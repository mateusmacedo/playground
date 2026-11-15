terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.1"
    }
  }

  # WHY: state em arquivo, ao lado deste env. O Floci é descartável e não há
  # conta AWS; o backend S3 com use_lockfile entra com a primeira conta
  # (gatilhos no ADR 0011).
  backend "local" {}
}
