# Módulo `alb`

ALB compartilhado da plataforma (L1). O listener HTTPS tem ação padrão `404` em JSON, e os serviços (L4) penduram as regras nele com o [`service-route`](../service-route/README.md), sem alterar a plataforma. A porta HTTP só redireciona para o HTTPS com 301. Os access logs vão para um bucket S3 do próprio módulo ([ADR 0014](../../../../docs/adr/0014-meta-de-seguranca-a-antecipa-https-e-logs-do-alb.md)).

```hcl
module "alb" {
  source = "../../../modules/alb"

  name               = "playground-local"
  subnet_ids         = module.network.public_subnet_ids
  security_group_ids = [module.network.alb_security_group_id]
  certificate_arn    = aws_acm_certificate.alb.arn
}
```

- **TLS**: porta `https_port` (443) com a política `ssl_policy` (`ELBSecurityPolicy-TLS13-1-2-2021-06`). O certificado vem de fora do módulo: no ambiente local, autoassinado e importado no ACM do Floci pelo env `platform`.
- **Bucket de logs** (`<nome>-alb-access-logs`): acesso público bloqueado, SSE-S3 (o único aceito pelo ALB), versionado, com expiração em `access_logs_retention_days` (90) e política que só aceita a entrega do ELB e só por HTTPS. `access_logs_force_destroy` (falso por padrão) deixa o destroy levar os logs, o que só faz sentido em ambiente descartável.
- WAF e deletion protection entram com usuários externos e conta AWS ([ADR 0011](../../../../docs/adr/0011-estrutura-profissional-do-terraform.md)).
- No Floci os listeners abrem as portas **dentro do container do emulador**; o `infra/local` publica a 443 em `127.0.0.1:8443` e a 80 em `127.0.0.1:8088`.
