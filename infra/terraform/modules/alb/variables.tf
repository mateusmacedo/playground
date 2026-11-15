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

variable "http_port" {
  description = "Porta do listener HTTP, onde os serviços penduram as regras."
  type        = number
  default     = 80
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
