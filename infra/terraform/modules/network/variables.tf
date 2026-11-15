variable "name" {
  description = "Prefixo dos nomes dos recursos, por exemplo playground-local."
  type        = string
}

variable "cidr_block" {
  description = "CIDR da VPC."
  type        = string
}

variable "public_subnets" {
  description = "Subnets públicas por zona de disponibilidade (zona => CIDR). O ALB exige pelo menos duas zonas."
  type        = map(string)

  validation {
    condition     = length(var.public_subnets) >= 2
    error_message = "O ALB exige subnets em pelo menos duas zonas de disponibilidade."
  }
}

variable "alb_listener_ports" {
  description = "Portas dos listeners do ALB abertas no security group dele (HTTPS e o redirecionamento HTTP)."
  type        = list(number)
  default     = [443, 80]
}

variable "alb_ingress_cidrs" {
  description = "CIDRs que alcançam o listener do ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "service_port_range" {
  description = "Faixa de portas que o ALB alcança nos serviços (container, instância ou NodePort)."
  type = object({
    from = number
    to   = number
  })
  default = {
    from = 8080
    to   = 32767
  }
}

variable "tags" {
  description = "Tags adicionais."
  type        = map(string)
  default     = {}
}
