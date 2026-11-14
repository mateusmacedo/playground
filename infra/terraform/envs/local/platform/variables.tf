variable "endpoint" {
  description = "Endpoint do Floci. Só aceita loopback: este env nunca aponta para a AWS."
  type        = string
  default     = "http://localhost:4566"

  validation {
    condition     = can(regex("^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$", var.endpoint))
    error_message = "O env local só aceita o Floci em loopback (http://localhost:<porta>)."
  }
}

variable "region" {
  description = "Região AWS emulada."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR da VPC."
  type        = string
}

variable "public_subnets" {
  description = "Subnets públicas por zona (zona => CIDR)."
  type        = map(string)
}

variable "container_services" {
  description = "Serviços de container; cada um ganha o repositório ECR playground-<serviço>."
  type        = set(string)
}

variable "enable_eks" {
  description = "Cria o cluster EKS (estágio 3). No Floci ele é um k3s real, que consome perto de 500 MB."
  type        = bool
  default     = false
}

variable "eks_version" {
  description = "Versão do Kubernetes do cluster EKS."
  type        = string
  default     = "1.31"
}
