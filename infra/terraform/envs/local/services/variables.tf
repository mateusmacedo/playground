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

variable "domain_name" {
  description = "Domínio dos hosts dos serviços no ALB (<serviço>.<domínio>)."
  type        = string
  default     = "playground.local"
}

variable "image_tag" {
  description = "Tag das imagens (L3). Nula usa tools/container/image-tag.sh, a mesma regra do docker:push-floci."
  type        = string
  default     = null
}

variable "services" {
  description = <<-EOT
    Serviços de container (L4) e o estágio de cada um. Em stages, a chave é o
    destino (ec2, ecs ou eks) e o valor é o peso no ALB: duas chaves ao mesmo
    tempo fazem o blue/green, peso 0 deixa o destino implantado fora da regra e
    tirar a chave o destrói. priority é o início da faixa reservada do serviço
    no ALB (registro em services.auto.tfvars).
  EOT
  type = map(object({
    stages            = map(number)
    priority          = number
    port              = optional(number, 8080)
    health_check_path = optional(string, "/health")
    image_tag         = optional(string)
    node_port         = optional(number)
    cpu               = optional(number, 256)
    memory            = optional(number, 512)
    environment       = optional(map(string), {})
  }))

  validation {
    condition = alltrue(flatten([
      for svc in values(var.services) : [for stage in keys(svc.stages) : contains(["ec2", "ecs", "eks"], stage)]
    ]))
    error_message = "Os estágios válidos são ec2, ecs e eks."
  }

  validation {
    condition     = alltrue([for svc in values(var.services) : length(svc.stages) > 0 && sum(values(svc.stages)) > 0])
    error_message = "Cada serviço precisa de pelo menos um estágio com peso maior que zero."
  }

  validation {
    condition     = length(distinct([for svc in values(var.services) : svc.priority])) == length(var.services)
    error_message = "Cada serviço tem a própria faixa de prioridade no ALB."
  }

  validation {
    condition     = alltrue([for svc in values(var.services) : !contains(keys(svc.stages), "eks") || svc.node_port != null])
    error_message = "O estágio eks exige node_port."
  }
}

variable "ec2_ami_id" {
  description = "AMI do estágio EC2. No Floci, ami-alpine vira um container Alpine."
  type        = string
  default     = "ami-alpine"
}

variable "ec2_registry_alias" {
  description = "Host da rede Docker que atende o ECR dentro da instância do Floci."
  type        = string
  default     = "floci"
}
