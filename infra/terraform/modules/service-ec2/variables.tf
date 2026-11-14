variable "name" {
  description = "Nome do serviço (por exemplo example-go); vira prefixo dos recursos."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,27}$", var.name))
    error_message = "Use minúsculas, dígitos e hífen, com até 28 caracteres."
  }
}

variable "vpc_id" {
  description = "VPC do target group."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets do Auto Scaling group."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups da instância."
  type        = list(string)
}

variable "ami_id" {
  description = "AMI da instância. Precisa de um gerenciador de pacotes (apk, dnf ou apt) para instalar o Docker, ou do Docker já instalado."
  type        = string
}

variable "instance_type" {
  description = "Tipo da instância (estágio 1: micro)."
  type        = string
  default     = "t3.micro"
}

variable "image" {
  description = "Referência completa da imagem OCI, <repositório>:sha-<commit> (artefato único, ADR 0008)."
  type        = string
}

variable "ecr_repository_arn" {
  description = "ARN do repositório ECR da imagem; restringe a permissão de pull da instância."
  type        = string
}

variable "container_port" {
  description = "Porta em que o serviço escuta (variável PORT do contrato de execução)."
  type        = number
  default     = 8080
}

variable "health_check_path" {
  description = "Path de health do contrato de execução."
  type        = string
  default     = "/health"
}

variable "environment" {
  description = "Variáveis de ambiente do container, além de PORT."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for key in keys(var.environment) : can(regex("^[A-Z_][A-Z0-9_]*$", key))])
    error_message = "Os nomes das variáveis seguem ^[A-Z_][A-Z0-9_]*$."
  }
}

variable "registry_alias" {
  description = "Só no Floci: host da rede Docker que atende o registry (floci). Vazio usa o login padrão do ECR (aws ecr get-login-password)."
  type        = string
  default     = ""
}

variable "docker_tmpfs_size" {
  description = "Tamanho do tmpfs do /var/lib/docker quando a instância é um container (Floci)."
  type        = string
  default     = "1g"
}

variable "desired_capacity" {
  description = "Instâncias no Auto Scaling group (estágio 1: uma)."
  type        = number
  default     = 1
}

variable "health_check_type" {
  description = "EC2 ou ELB. ELB troca a instância quando o target group a reprova."
  type        = string
  default     = "EC2"

  validation {
    condition     = contains(["EC2", "ELB"], var.health_check_type)
    error_message = "Use EC2 ou ELB."
  }
}

variable "health_check_grace_period" {
  description = "Segundos antes de o ASG avaliar a saúde de uma instância nova."
  type        = number
  default     = 180
}

variable "deregistration_delay" {
  description = "Segundos de drenagem ao tirar um alvo do target group."
  type        = number
  default     = 10
}

variable "wait_for_capacity_timeout" {
  description = "Quanto o apply espera o ASG ficar com a capacidade desejada."
  type        = string
  default     = "10m"
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
