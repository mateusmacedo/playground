# Módulo `service-eks`

Estágio 3 de um serviço de container ([ADR 0008](../../../../docs/adr/0008-adapters-de-runtime.md)): namespace, deployment (probes em `/health`, `PORT`, requests e limits) e service `NodePort` no cluster EKS da plataforma, mais um target group no ALB compartilhado com os nós como alvo. A regra no ALB é do [`service-route`](../service-route/README.md).

Precisa do provider `kubernetes` configurado pelo env `services` (endpoint, CA e token do cluster).

```hcl
module "eks" {
  source = "../../../modules/service-eks"

  name      = "example-go"
  vpc_id    = local.platform.vpc_id
  image     = "${local.repository_url}:sha-abc1234"
  node_port = 30100 # do registro de faixas
}
```

- **Por que NodePort e não ingress**: o tráfego continua entrando pelo ALB compartilhado e pela regra ponderada, que é o que permite o blue/green entre estágios. Na AWS, o AWS Load Balancer Controller com `TargetGroupBinding` faz o mesmo papel; ele não roda no Floci.
- Os nós vêm do `providerID` (`aws:///<zona>/i-...`), e o alvo é o IP privado da instância do nó na NodePort.

## No Floci

- O cluster é um k3s real; a imagem vem do ECR do Floci pelo mirror que ele injeta no containerd, sem configuração.
- O nó do k3s aparece como instância EC2 (`providerID` com `i-...`). Com alvo do tipo `instance`, o health check do Floci 2.4.0 não alcança o nó; com alvo `ip` no IP privado da instância (o endereço na rede `playground-floci`), funciona. Na AWS, os dois modos funcionam.
