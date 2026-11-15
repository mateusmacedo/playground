# Módulo `service-ec2`

Estágio 1 de um serviço de container ([ADR 0008](../../../../docs/adr/0008-adapters-de-runtime.md)): launch template (IMDSv2), Auto Scaling group de uma instância, role com permissão de pull só no repositório do serviço e target group do tipo `instance`. A regra no ALB é do [`service-route`](../service-route/README.md).

O user data ([`templates/user-data.sh.tftpl`](./templates/user-data.sh.tftpl)) instala o Docker (apk, dnf ou apt), faz login no ECR, roda **a mesma imagem OCI** de ECS e EKS (`<repositório>:sha-<commit>`) com rede host e `PORT`, e espera o `/health`. Imagem nova gera versão nova do launch template e um instance refresh.

```hcl
module "ec2" {
  source = "../../../modules/service-ec2"

  name               = "example-go"
  vpc_id             = local.platform.vpc_id
  subnet_ids         = local.platform.subnet_ids
  security_group_ids = [local.platform.services_security_group_id]
  ami_id             = "ami-alpine" # na AWS: Amazon Linux 2023
  image              = "${local.repository_url}:sha-abc1234"
  ecr_repository_arn = local.repository_arn
  registry_alias     = "floci" # só no Floci
}
```

## No Floci

A instância do Floci é um container Docker **privilegiado**, então o Docker aninhado funciona e o artefato continua único. Dois ajustes, ambos detectados ou ligados por variável:

- Sem systemd e com a raiz em overlay, o script monta `tmpfs` em `/var/lib/docker` (overlay sobre overlay falha) e sobe o `dockerd` em segundo plano.
- `registry_alias = "floci"`: o host do ECR do Floci (`*.localhost:4566`) resolveria para a própria instância; o script aponta esse nome para o Floci na rede Docker e marca o registry como inseguro (sem TLS). Vazio, usa `aws ecr get-login-password`.

O `apk add` baixa o Docker da internet a cada instância nova (cerca de 6 s). Um reboot da instância não religa o `dockerd`, porque não há init no container.
