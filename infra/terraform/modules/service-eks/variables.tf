variable "name" {
  description = "Nome do serviço (por exemplo example-go); vira o namespace, o deployment e o service."
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

variable "image" {
  description = "Referência completa da imagem OCI, <repositório>:sha-<commit> (artefato único, ADR 0008)."
  type        = string
}

variable "container_port" {
  description = "Porta em que o serviço escuta (variável PORT do contrato de execução)."
  type        = number
  default     = 8080
}

variable "node_port" {
  description = "NodePort do service; o ALB alcança os nós nessa porta. Vem do registro de faixas, para não colidir entre serviços."
  type        = number

  validation {
    condition     = var.node_port >= 30000 && var.node_port <= 32767
    error_message = "O NodePort fica entre 30000 e 32767."
  }
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

variable "replicas" {
  description = "Réplicas do deployment."
  type        = number
  default     = 1
}

variable "resources" {
  description = "Requests e limits do container."
  type = object({
    cpu_request    = string
    memory_request = string
    memory_limit   = string
  })
  default = {
    cpu_request    = "100m"
    memory_request = "64Mi"
    memory_limit   = "256Mi"
  }
}

variable "deregistration_delay" {
  description = "Segundos de drenagem ao tirar um alvo do target group."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags adicionais dos recursos AWS."
  type        = map(string)
  default     = {}
}
