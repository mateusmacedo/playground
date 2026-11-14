variable "name" {
  description = "Nome do serviço (por exemplo example-go); vira prefixo dos recursos."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,27}$", var.name))
    error_message = "Use minúsculas, dígitos e hífen, com até 28 caracteres."
  }
}

variable "cluster_arn" {
  description = "Cluster ECS da plataforma (L1), lido do SSM."
  type        = string
}

variable "vpc_id" {
  description = "VPC do target group."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets das tasks (awsvpc)."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups das tasks."
  type        = list(string)
}

variable "assign_public_ip" {
  description = "Endereço público nas tasks: necessário em subnet pública sem NAT, para o pull da imagem."
  type        = bool
  default     = false
}

variable "image" {
  description = "Referência completa da imagem OCI, <repositório>:sha-<commit> (artefato único, ADR 0008)."
  type        = string
}

variable "ecr_repository_arn" {
  description = "ARN do repositório ECR da imagem; restringe a permissão de pull da task."
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
}

variable "cpu" {
  description = "CPU da task em unidades (par válido do Fargate com memory)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memória da task em MiB (par válido do Fargate com cpu)."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Quantidade de tasks."
  type        = number
  default     = 1
}

variable "log_retention_days" {
  description = "Retenção do log group da task, em dias."
  type        = number
  default     = 14
}

variable "deregistration_delay" {
  description = "Segundos de drenagem ao tirar um alvo do target group."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
