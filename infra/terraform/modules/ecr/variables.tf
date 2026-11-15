variable "repositories" {
  description = "Nomes dos repositórios, um por serviço de container (por exemplo playground-example-go)."
  type        = set(string)
}

variable "image_tag_mutability" {
  description = "IMMUTABLE garante que a tag sha-<commit> sempre aponte para o mesmo digest (ADR 0008)."
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "Use MUTABLE ou IMMUTABLE."
  }
}

variable "scan_on_push" {
  description = "Liga o scan de vulnerabilidades no push."
  type        = bool
  default     = true
}

variable "force_delete" {
  description = "Permite apagar o repositório com imagens. Só faz sentido em ambiente descartável, como o local."
  type        = bool
  default     = false
}

variable "keep_last_images" {
  description = "Quantas imagens a lifecycle policy mantém por repositório."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
