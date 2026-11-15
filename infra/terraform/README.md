# infra/terraform

Terraform do playground. Hoje existe só o ambiente local, no [Floci](../local/README.md): a decisão e os gatilhos para crescer estão no [ADR 0011](../../docs/adr/0011-estrutura-profissional-do-terraform.md); o dono de cada recurso, no [ADR 0004](../../docs/adr/0004-serverless-e-terraform.md); as camadas, no [ADR 0009](../../docs/adr/0009-camadas-e-ordem-de-implantacao.md).

```text
infra/terraform/
  modules/               network, ecr, alb, service-route, service-ec2, service-ecs, service-eks, ssm-contract
  envs/local/platform/   L1 (infra-local-platform): rede, ECR, ALB, cluster ECS e EKS opcional; publica o contrato no SSM
  envs/local/services/   L4 (infra-local-services): serviços de container em EC2, ECS ou EKS; lê a plataforma só pelo SSM
  scripts/alb-smoke.sh   L6: smoke dos serviços pelo ALB do Floci
```

Requisitos: Terraform 1.11 ou mais novo, tflint com o plugin aws (`tflint --init --config .tflint.hcl`, na raiz) e Docker.

## Comandos

Sempre pelo Nx, na raiz:

| Para                                                     | Comando                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| Subir tudo: Floci, plataforma, imagens, serviços e smoke | `pnpm nx run infra-local:local:provision`                       |
| Destruir serviços e plataforma                           | `pnpm nx run infra-local:local:destroy`                         |
| Planejar ou aplicar uma camada                           | `pnpm nx run infra-local-platform:plan` (ou `apply`, `destroy`) |
| Gates do que mudou                                       | `pnpm nx affected -t fmt validate lint test`                    |
| Conferir o ALB                                           | `pnpm nx run infra-local-services:smoke`                        |
| Ligar o EKS (estágio 3; o k3s consome perto de 500 MB)   | `TF_VAR_enable_eks=true pnpm nx run infra-local-platform:apply` |

- `fmt`, `validate`, `lint` e `test` usam o cache do Nx; as entradas são os `.tf` do env e dos módulos que ele chama, o lock, a versão do Terraform e, no `lint`, o `.tflint.hcl` e a versão do tflint. `init`, `plan`, `apply`, `destroy` e `smoke` não usam cache.
- O `test` roda o `terraform test` (provider simulado, sem Floci) nos módulos que o env chama: `network`, `ecr`, `alb` e `ssm-contract` no `platform`; `service-route`, `service-ec2`, `service-ecs` e `service-eks` no `services`. Cada módulo tem o próprio `.terraform.lock.hcl` versionado, porque o `init` do teste usa `-lockfile=readonly` (o mesmo `TF_CLI_ARGS_init` do CI) e o Renovate atualiza os locks dos módulos e dos envs juntos. Módulo novo com teste entra na lista do `test` e nas entradas `terraformModuleTests` do `project.json` do env que o chama.
- Todo target roda o Terraform com `TF_DATA_DIR=tmp/terraform/<projeto>`, para não haver `.terraform/` no repositório; o `test` usa `<projeto>-<módulo>`. Com `-chdir`, o `TF_DATA_DIR` relativo vale a partir da pasta do módulo, e não da do env. À mão, exporte o mesmo valor (por exemplo `TF_DATA_DIR=$PWD/tmp/terraform/infra-local-platform`). O `.terraform.lock.hcl` fica na pasta do env.
- O `apply` do `services` publica antes as imagens (`docker:push-floci` de `example-go` e `example-quarkus`). A tag sai de `tools/container/image-tag.sh`, a mesma regra do push.
- O state é um `terraform.tfstate` em cada env, ignorado pelo git. O `infra-local:reset` apaga o emulador, mas não o state: depois dele, mande os `terraform.tfstate*` dos dois envs para a lixeira antes do próximo `local:provision`.
- O provider usa as credenciais `test`/`test` e só aceita endpoint em loopback: estes envs não alcançam uma conta real.

## Estágios e blue/green

O estágio de cada serviço fica em [`envs/local/services/services.auto.tfvars`](./envs/local/services/services.auto.tfvars), que também é o registro das faixas de prioridade do ALB e das NodePorts. Cada serviço é roteado por host (`<serviço>.playground.local`, qualquer path) e por path (`/<serviço>` e `/<serviço>/*`), no listener HTTP, publicado no host em `http://localhost:8088`. Uma migração é uma sequência de applies:

| Passo | `stages`                 | Efeito                                                                |
| ----- | ------------------------ | --------------------------------------------------------------------- |
| 1     | `{ ec2 = 100, ecs = 0 }` | Sobe o ECS fora do roteamento; dá para checar a saúde do target group |
| 2     | `{ ec2 = 50, ecs = 50 }` | Divide o tráfego                                                      |
| 3     | `{ ec2 = 0, ecs = 100 }` | Tira a EC2 da regra                                                   |
| 4     | `{ ecs = 100 }`          | Destrói a EC2                                                         |

Peso 0 tira o target group da regra, e só o passo seguinte o destrói; num apply só, o Terraform tentaria apagar o target group antes de atualizar a regra.

## Validação no Floci 2.4.0

A PoC (2026-11-14) passou pelos três estágios com `example-go` e `example-quarkus`:

| Estágio         | Requisição                                                   | Resultado                            | Apply               |
| --------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------- |
| 1: EC2          | `Host: example-go.playground.local` `/health`; `/example-go` | 204 (o health do serviço é 204); 200 | 39 s                |
| 2: EC2 para ECS | 200 requisições em `/example-go` com 50/50                   | 200 ok; 41% EC2, 59% ECS             | 17 a 18 s por passo |
| Java no ECS     | `/health`; `/example-quarkus`                                | 200; 200                             | 21 s                |
| 3: ECS para EKS | 200 requisições com 50/50                                    | 200 ok; 45% ECS, 55% EKS             | 25 a 49 s por passo |
| 3: 100% EKS     | `/health`; `/example-go`                                     | 204; 200                             | 33 s                |

Memória: a instância EC2 (t3.micro) usou cerca de 93 MiB, a task do `example-go` 12 MiB, a do Quarkus 114 MiB e o k3s cerca de 490 MiB.

## O que o Floci 2.4.0 suporta

| Recurso                                                 | Suportado?      | Observação                                                                                                                                     |
| ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| VPC, subnets, IGW, rotas, SGs                           | Sim             | Cada VPC vira uma rede Docker. SGs não filtram tráfego entre containers.                                                                       |
| ECR (repositório, lifecycle, IMMUTABLE)                 | Sim             | `registry:2` atrás de `*.dkr.ecr.us-east-1.localhost:4566`, sem autenticação.                                                                  |
| ALB, listener com resposta fixa, regras por host e path | Sim             | O listener abre dentro do container do Floci; do host, só com a porta publicada no compose.                                                    |
| ACM (certificado importado) e listener HTTPS            | Sim             | TLS 1.3 real com o certificado importado; HTTP na porta do HTTPS é recusado.                                                                   |
| Redirecionamento HTTP para HTTPS (301)                  | Sim, com desvio | O `Location` duplica a barra do path (`https://localhost:443//example-go`) e leva a porta interna (443), não a publicada no host.              |
| Access logs do ALB no S3                                | Parcial         | O atributo e o bucket são aceitos, mas o Floci não entrega os arquivos de log.                                                                 |
| Regra com target groups ponderados                      | Sim             | A divisão segue os pesos (medida acima).                                                                                                       |
| Tirar um target group de uma regra                      | Parcial         | `ModifyRule` não libera o target group, e o `DeleteTargetGroup` dá `ResourceInUse`. Contorno: `replace_on_target_group_change` recria a regra. |
| Launch template e ASG com target group                  | Sim             | O ASG cria a instância e registra no target group.                                                                                             |
| EC2 rodando a imagem OCI                                | Sim, com ajuste | A instância é um container privilegiado; o Docker aninhado precisa de `tmpfs` em `/var/lib/docker` e do alias `floci` para o ECR.              |
| IAM (roles, instance profile, políticas)                | Sim             | Aceita, mas não aplica as políticas.                                                                                                           |
| ECS Fargate com ALB                                     | Sim             | Task é um container real; o Floci registra o IP do container no target group. `awslogs` chega ao CloudWatch Logs.                              |
| EKS                                                     | Sim             | k3s real; pull do ECR do Floci pelo mirror automático.                                                                                         |
| Token do EKS com `test`/`test`                          | Não             | O webhook recusa as credenciais públicas. Contorno: usuário IAM local com a chave no Secrets Manager (`envs/local/platform/eks.tf`).           |
| Alvo `instance` apontando para o nó k3s                 | Não             | Health check falha. Contorno: alvo `ip` com o IP privado da instância do nó.                                                                   |
