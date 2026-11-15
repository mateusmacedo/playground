# Módulo `service-ecs`

Estágio 2 de um serviço de container ([ADR 0008](../../../../docs/adr/0008-adapters-de-runtime.md)): task definition Fargate (`awsvpc`), serviço ECS no cluster da plataforma, target group do tipo `ip`, log group `/ecs/<serviço>`, role de execução (pull só no repositório do serviço e escrita no log group) e role da task, vazia, onde entram as permissões do serviço. A regra no ALB é do [`service-route`](../service-route/README.md).

```hcl
module "ecs" {
  source = "../../../modules/service-ecs"

  name               = "example-go"
  cluster_arn        = local.platform.ecs_cluster_arn
  vpc_id             = local.platform.vpc_id
  subnet_ids         = local.platform.subnet_ids
  security_group_ids = [local.platform.services_security_group_id]
  assign_public_ip   = true
  image              = "${local.repository_url}:sha-abc1234"
  ecr_repository_arn = local.repository_arn
}
```

- O container recebe `PORT` e as variáveis de `environment`.
- Deploy com `minimum 100%`, `maximum 200%` e circuit breaker com rollback.
- Sem NAT, a task em subnet pública precisa de `assign_public_ip = true` para baixar a imagem.
- No Floci a task é um container real; o Floci registra o endereço do container no target group, e o `awslogs` chega ao CloudWatch Logs emulado.
