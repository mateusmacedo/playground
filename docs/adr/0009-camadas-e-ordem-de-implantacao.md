# ADR 0009: Camadas, fronteiras e ordem de implantação

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

A infraestrutura é dividida entre Terraform e Serverless Framework ([ADR 0004](./0004-serverless-e-terraform.md)) e o backend pode rodar em Lambda ou em container ([ADR 0008](./0008-adapters-de-runtime.md)). Sem camadas explícitas, a ordem de criação fica implícita, as dependências viram ciclos (o CloudFront precisa da URL da API, que precisa do domínio...) e um deploy de serviço pode acabar mexendo na plataforma.

Precisamos de camadas com dono, escopo e proibições claros, de uma regra de precedência e de uma ordem de implantação que seja a mesma do `local` (Floci) à produção.

## Decisão

### Camadas

| Camada             | Dono                                                         | Escopo                                                                                                                                                                  | Proibido                                                    |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **L0 bootstrap**   | Terraform `envs/<stage>/bootstrap`                           | Bucket e KMS do state, role OIDC do GitHub, budgets. Roda uma vez por ambiente com credencial privilegiada.                                                             | Qualquer recurso de aplicação.                              |
| **L1 platform**    | Terraform                                                    | VPC, subnets, SG base, VPC endpoints, KMS, Cognito, ACM, zona Route 53, ECR (um repositório por serviço de container), clusters ECS e EKS, ALB com listener padrão 404. | Recursos de serviço específico.                             |
| **L2 data**        | Terraform                                                    | Tudo que é stateful ou compartilhado: DynamoDB, RDS, buckets, SQS, SNS, EventBridge, com `prevent_destroy`.                                                             | Compute e lógica.                                           |
| **L3 artefatos**   | Build do Nx                                                  | Zip da Lambda e imagem OCI com a tag `sha-<commit>`, enviada ao ECR.                                                                                                    | Criar infraestrutura.                                       |
| **L4 serviços**    | Serverless (Lambdas) ou Terraform `services` (EC2, ECS, EKS) | Função, rotas, gatilhos, role do serviço, target group com a regra no ALB, e o serviço em si.                                                                           | Criar recurso de L1 ou L2; depender de outro serviço de L4. |
| **L5 edge**        | Terraform                                                    | CloudFront, domínios, mapeamentos de API, WAF.                                                                                                                          | Recursos de serviço.                                        |
| **L6 verificação** | Nx e CI                                                      | Smoke tests e `contract:check`.                                                                                                                                         | -                                                           |

O **frontend Next** é um serviço de L4 (Lambda `webApps` ou container). O CloudFront fica em L5, e os assets estáticos ficam em um bucket de L2.

### Precedência

```text
 ordem de implantação                       a dependência aponta para trás

 L0 bootstrap                               L6 verifica L5, L4...
   v                                        L5 edge     usa o que L4 publicou
 L1 platform                                L4 serviço  usa L1, L2 e L3
   v                                        L3 artefato usa o ECR de L1
 L2 data                                    L2 data     usa L1
   v                                        L1 platform usa L0
 L3 artefatos
   v                                        Toda referência passa pelo SSM
 L4 serviços (em paralelo entre si)         canônico, nunca pelo state.
   v
 L5 edge
   v
 L6 verificação
```

- A dependência só aponta **para baixo**, isto é, para as camadas de número menor (L5 usa L4, nunca o contrário), sempre pelo SSM canônico, sem `terraform_remote_state`, nem entre camadas do próprio Terraform.
- **Serviços não dependem de serviços.** O que é compartilhado mora em L2.

### Ciclos e como evitá-los

| Ciclo                                            | Como se evita                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| CloudFront precisa da URL da API                 | A API publica a URL no SSM e o edge (L5) roda **depois** dos serviços.                       |
| CORS precisa do domínio do CloudFront            | O CORS usa o **domínio customizado**, conhecido em L1, nunca o domínio gerado do CloudFront. |
| Permissão em recurso compartilhado de L2         | A permissão fica na **role do serviço** (identity-based), e não em resource policy de L2.    |
| Prioridade de regra no ALB colide entre serviços | Cada serviço tem uma **faixa reservada** de prioridades, em um registro versionado.          |
| ECS e EKS precisam da imagem construída em L3    | Recebem o tag como variável: `image_tag=sha-<commit>`.                                       |

### Fases

| Camada | Quando roda                                     | Ordem de criação | Ordem de destruição |
| ------ | ----------------------------------------------- | ---------------- | ------------------- |
| L0     | Uma vez, manual                                 | 1ª               | Nunca               |
| L1     | Mudança de plataforma, rara                     | 2ª               | Penúltima           |
| L2     | Rara                                            | 3ª               | Manual e protegida  |
| L3     | Todo commit                                     | 4ª               | Não se aplica       |
| L4     | Todo release, por serviço                       | 5ª               | 2ª (depois do edge) |
| L5     | Mudança de domínio ou rota, e após o 1º serviço | 6ª               | 1ª                  |

### Promoção

- `local` (Floci) para `dev`: **automático** no merge na `main`.
- `dev` para `homolog`: por **tag de release candidate**.
- `homolog` para `prod`: por **tag de release**, com **aprovação** no environment do GitHub.
- O artefato promovido é o **mesmo** (a imagem com a tag `sha-<commit>`, ou o zip). Por ambiente rodam só o `plan` e o `apply`.
- No Floci a ordem é a mesma, com o target `local:provision`. Hoje ele encadeia `infra-local:up`, L1 (`infra-local-platform`), L3 (push das imagens), L4 (`infra-local-services`) e L6 (smoke); L2 e L5 entram quando existirem.
- **Gate entre fases**: cada fase checa os parâmetros SSM de que precisa e falha cedo, listando o que falta.

### Nx

- Projetos `infra-<stage>-{bootstrap,platform,data,services,edge}`, com `plan` e `apply` **sem cache**.
- As `implicitDependencies` (L2 para L1, L4 para L2, L5 para L4) servem **só** para o grafo e o `affected`.
- O `nx deploy` local **nunca** aplica infraestrutura como dependência.
- A ordem de `apply` fica **explícita** no workflow de CI e no `local:provision`.

## Consequências

- **Ganhos**: a ordem de criação e de destruição é uma tabela, e não conhecimento tácito; dependência só para camadas de número menor impede ciclos; o `local` ensaia a mesma ordem da produção.
- **Hoje**: **parcialmente implementado.** Existe o Terraform local ([ADR 0011](./0011-estrutura-profissional-do-terraform.md)): `infra-local-platform` (L1) e `infra-local-services` (L4), o `local:provision` e o gate do contrato SSM no plan do `services`. Continuam alvo: L0, L2 e L5, os projetos `infra-<stage>-*` e o `contract:check`. O bucket de uploads e a fila `sample-events` seguem no seed do `infra/local`.
- **Custos**: o registro de faixas de prioridade do ALB e o catálogo de parâmetros SSM precisam de manutenção e de um dono.
- **Gatilho de revisão**: um recurso que não caiba em nenhuma camada, ou uma dependência que exija apontar para uma camada de número maior.
