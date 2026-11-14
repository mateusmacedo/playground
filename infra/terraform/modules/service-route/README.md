# Módulo `service-route`

Regras de um serviço no listener HTTP do ALB compartilhado (L4): uma por host (`priority`) e outra por path (`priority + 1`), ambas com encaminhamento **ponderado** para os target groups dos estágios ativos. É onde acontece o blue/green entre EC2, ECS e EKS ([ADR 0008](../../../../docs/adr/0008-adapters-de-runtime.md)).

```hcl
module "route" {
  source = "../../../modules/service-route"

  listener_arn  = local.contract["platform/alb/http-listener-arn"]
  priority      = 100
  host_headers  = ["example-go.playground.local"]
  path_patterns = ["/example-go", "/example-go/*"]
  target_groups = {
    ec2 = { arn = module.ec2.target_group_arn, weight = 50 }
    ecs = { arn = module.ecs.target_group_arn, weight = 50 }
  }
}
```

- A regra fica fora dos módulos de estágio porque uma única regra precisa apontar para dois estágios durante a migração.
- `priority` vem do registro de faixas reservadas (no `services.auto.tfvars` do env `services`): cada serviço tem a sua.
- `replace_on_target_group_change` recria as regras quando um estágio entra ou sai da regra. Só serve ao Floci 2.4.0, cujo `ModifyRule` não libera o target group retirado (o `DeleteTargetGroup` seguinte falha com `ResourceInUse`). Na AWS, deixe `false`.
