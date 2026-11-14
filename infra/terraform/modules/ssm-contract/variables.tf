variable "app" {
  description = "Primeiro segmento do caminho canônico."
  type        = string
  default     = "playground"
}

variable "stage" {
  description = "Stage: local, dev, homolog ou prod."
  type        = string

  validation {
    condition     = contains(["local", "dev", "homolog", "prod"], var.stage)
    error_message = "Stage inválido: use local, dev, homolog ou prod."
  }
}

variable "region" {
  description = "Região AWS do caminho canônico."
  type        = string
}

variable "parameters" {
  description = "Parâmetros a publicar, no formato <domínio>/<recurso>/<atributo> => valor. Listas vão como texto separado por vírgula."
  type        = map(string)

  validation {
    condition = alltrue([
      for key in keys(var.parameters) : can(regex("^[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+$", key))
    ])
    error_message = "Cada chave segue <domínio>/<recurso>/<atributo>, em minúsculas com hífen."
  }
}

variable "layer" {
  description = "Camada que publica (L1, L2, L4...), gravada na descrição e na tag."
  type        = string
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
