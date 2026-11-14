output "routes" {
  description = "Como cada serviço é alcançado no ALB (host e path), com o peso de cada estágio."
  value = {
    for name, svc in local.services : name => {
      host    = svc.host
      path    = "/${name}"
      weights = module.route[name].weights
    }
  }
}

output "http_listener_port" {
  description = "Porta do listener HTTP do ALB (no Floci, dentro do container do emulador)."
  value       = local.platform.listener_port
}
