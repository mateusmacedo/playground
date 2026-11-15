variable "listener_arn" {
  description = "Listener do ALB compartilhado (publicado pela plataforma no SSM)."
  type        = string
}

variable "priority" {
  description = "Início da faixa reservada do serviço no registro de prioridades. Usa priority (host) e priority + 1 (path)."
  type        = number

  validation {
    condition     = var.priority >= 1 && var.priority <= 49998
    error_message = "A prioridade fica entre 1 e 49998 (a regra de path usa priority + 1)."
  }
}

variable "host_headers" {
  description = "Hosts roteados para o serviço em qualquer path, por exemplo example-go.playground.local. Lista vazia desliga a regra de host."
  type        = list(string)
  default     = []
}

variable "path_patterns" {
  description = "Paths roteados para o serviço em qualquer host. Lista vazia desliga a regra de path."
  type        = list(string)
  default     = []
}

variable "target_groups" {
  description = "Target groups ativos por estágio (ec2, ecs, eks), com o peso de cada um. É aqui que acontece o blue/green."
  type = map(object({
    arn    = string
    weight = number
  }))

  validation {
    condition     = length(var.target_groups) > 0 && sum([for tg in values(var.target_groups) : tg.weight]) > 0
    error_message = "Informe pelo menos um target group, com soma de pesos maior que zero."
  }

  validation {
    condition     = alltrue([for tg in values(var.target_groups) : tg.weight >= 0 && tg.weight <= 999])
    error_message = "Cada peso fica entre 0 e 999."
  }
}

variable "replace_on_target_group_change" {
  description = "Recria as regras quando o conjunto de target groups muda (não quando só o peso muda). Só para o Floci 2.4.0, cujo ModifyRule não libera o target group retirado; na AWS, deixe false."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
