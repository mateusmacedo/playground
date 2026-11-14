# Módulo `alb`

ALB compartilhado da plataforma (L1) com um listener HTTP cuja ação padrão é `404` em JSON. Os serviços (L4) penduram as regras nele com o [`service-route`](../service-route/README.md), sem alterar a plataforma.

```hcl
module "alb" {
  source = "../../../modules/alb"

  name               = "playground-local"
  subnet_ids         = module.network.public_subnet_ids
  security_group_ids = [module.network.alb_security_group_id]
}
```

- HTTPS, access logs, WAF e deletion protection entram com usuários externos e conta AWS ([ADR 0011](../../../../docs/adr/0011-estrutura-profissional-do-terraform.md)).
- No Floci o listener abre a porta **dentro do container do emulador**; o `infra/local` publica a 80 em `127.0.0.1:8088`.
