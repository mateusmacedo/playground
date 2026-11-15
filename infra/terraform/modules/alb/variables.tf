variable "name" {
  description = "Nome do ALB (até 32 caracteres)."
  type        = string

  validation {
    condition     = length(var.name) <= 32
    error_message = "O nome do ALB tem no máximo 32 caracteres."
  }
}

variable "subnet_ids" {
  description = "Subnets do ALB, em pelo menos duas zonas."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups do ALB."
  type        = list(string)
}

variable "certificate_arn" {
  description = "ARN do certificado do ACM servido pelo listener HTTPS."
  type        = string
}

variable "https_port" {
  description = "Porta do listener HTTPS, onde os serviços penduram as regras."
  type        = number
  default     = 443
}

variable "http_port" {
  description = "Porta HTTP que só redireciona para o HTTPS."
  type        = number
  default     = 80
}

variable "ssl_policy" {
  description = "Política de TLS do listener HTTPS."
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

variable "access_logs_retention_days" {
  description = "Dias de retenção dos access logs do ALB no S3."
  type        = number
  default     = 90

  validation {
    condition     = var.access_logs_retention_days >= 1
    error_message = "A retenção dos access logs é de pelo menos 1 dia."
  }
}

variable "access_logs_force_destroy" {
  description = "Permite apagar o bucket de logs com objetos dentro (só em ambiente descartável)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
