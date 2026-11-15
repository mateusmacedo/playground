# Guia: ordem de implantação

Em que ordem a infraestrutura e os serviços são criados, promovidos e destruídos, do Floci à produção. A decisão está no [ADR 0009](../adr/0009-camadas-e-ordem-de-implantacao.md); a divisão de donos, no [ADR 0004](../adr/0004-serverless-e-terraform.md); os destinos de runtime, no [ADR 0008](../adr/0008-adapters-de-runtime.md).

> **Estado atual.** Só existe o ambiente local: o Floci (`infra-local`), o deploy de serviços Serverless nele e o Terraform local (`infra-local-platform` e `infra-local-services`), encadeados pelo `local:provision` ([ADR 0011](../adr/0011-estrutura-profissional-do-terraform.md)). L0, L2, L5, os ambientes da AWS e o `contract:check` estão **a implementar**. As seções abaixo marcam o que é de hoje e o que é alvo.

## As camadas

| Camada             | Dono                               | O que cria                                                                       | Existe hoje?                                                                                                |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **L0 bootstrap**   | Terraform                          | Bucket e KMS do state, role OIDC do GitHub, budgets                              | A implementar                                                                                               |
| **L1 platform**    | Terraform                          | Rede, KMS, Cognito, ACM, Route 53, ECR, clusters ECS e EKS, ALB com listener 404 | Só local: rede, ECR, ALB com listener 404 e clusters ECS e EKS (`infra-local-platform`).                    |
| **L2 data**        | Terraform                          | DynamoDB, RDS, buckets, SQS, SNS, EventBridge (com `prevent_destroy`)            | A implementar. Localmente, o bootstrap cria buckets, filas e tabelas de exemplo.                            |
| **L3 artefatos**   | Build do Nx                        | Zip da Lambda, imagem OCI com a tag `sha-<commit>`                               | Parcial: zips de Lambda de Go e Java, e a imagem OCI de `example-go` e `example-quarkus` (`docker:build`).  |
| **L4 serviços**    | Serverless ou Terraform `services` | Funções, rotas, gatilhos, role do serviço, target group                          | Parcial: Lambdas com Serverless no Floci e containers em EC2, ECS ou EKS do Floci (`infra-local-services`). |
| **L5 edge**        | Terraform                          | CloudFront, domínios, mapeamentos de API, WAF                                    | A implementar                                                                                               |
| **L6 verificação** | Nx e CI                            | Smoke tests e `contract:check`                                                   | Parcial: smoke do ALB no Floci (`infra-local-services:smoke`); `contract:check` a implementar.              |

O frontend Next é um serviço de L4 (Lambda `webApps` ou container). O CloudFront fica em L5 e os assets estáticos, em um bucket de L2. **Hoje o backoffice não tem deploy**: roda só com `next dev` e `next start`.

## A ordem

```text
 criação:    L0 -> L1 -> L2 -> L3 -> L4 -> L5 -> L6
 destruição: L5 -> L4 -> L2 (à mão, protegida) -> L1 -> L0 (nunca)

 L3 não é destruída: artefatos são só construídos.
```

| Camada | Quando roda                                        | Criação | Destruição         |
| ------ | -------------------------------------------------- | ------- | ------------------ |
| L0     | Uma vez por ambiente, manual                       | 1ª      | Nunca              |
| L1     | Mudança de plataforma (rara)                       | 2ª      | Penúltima          |
| L2     | Rara                                               | 3ª      | Manual e protegida |
| L3     | Todo commit                                        | 4ª      | Não se aplica      |
| L4     | Todo release, por serviço                          | 5ª      | 2ª, depois do edge |
| L5     | Mudança de domínio ou de rota, e após o 1º serviço | 6ª      | 1ª                 |

Regras que valem sempre:

- A dependência aponta **só para baixo**, isto é, para camadas de número menor (L5 usa L4, nunca o contrário), e sempre pelo SSM canônico. Nada de `terraform_remote_state`.
- **Serviços não dependem de serviços.** Se dois precisam do mesmo recurso, ele sobe para L2.
- O `nx deploy` de um serviço **nunca** aplica infraestrutura como dependência. A ordem de `apply` é explícita no CI e no `local:provision`.

## Ambiente local (Floci)

**Hoje**, o fluxo é este:

```bash
pnpm nx up infra-local                     # sobe o Floci e roda o bootstrap (bucket, fila, SSM)
pnpm nx run infra-local:local:provision    # L1, push das imagens (L3), L4 em container e smoke (L6)
pnpm nx deploy example-ts                  # L4: Lambda no Floci, configuration floci
```

**Alvo** (a implementar): o `local:provision` cobrir também L2 e L5 quando existirem. Aí o bucket de uploads e a fila `sample-events` saem do bootstrap de `infra/local` para o Terraform.

Tudo roda no Floci, **inclusive a implantação do frontend** como se fosse na AWS. Os destinos de container também têm emulação, segundo a documentação do Floci (veja o [overview de arquitetura](../architecture/overview.md#destinos-de-deploy)).

## Promoção entre ambientes

```text
 local (Floci) --merge na main--> dev --tag de RC--> homolog --tag de release--> prod
                (automático)             (por tag)                (com aprovação
                                                                   no environment
                                                                   do GitHub)
```

- O artefato promovido é o **mesmo**: a imagem com a tag `sha-<commit>`, ou o zip, construído em L3. Por ambiente rodam só o `plan` e o `apply`.
- No Floci a ordem é a mesma de `dev` e `prod`.
- **Gate entre fases**: cada fase confere os parâmetros SSM de que precisa e falha cedo, listando o que falta, em vez de falhar no meio do `apply`.

## Ciclos que a ordem evita

| Ciclo                                 | Como se evita                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| CloudFront precisa da URL da API      | A API publica a URL no SSM e o edge (L5) roda depois dos serviços (L4).             |
| CORS precisa do domínio do CloudFront | Use o domínio customizado, conhecido em L1, nunca o gerado pelo CloudFront.         |
| Permissão em recurso compartilhado    | Dê a permissão na role do serviço (identity-based), e não em resource policy de L2. |
| Prioridade de regra no ALB            | Cada serviço tem uma faixa reservada, em um registro versionado.                    |
| Imagem construída em L3               | ECS e EKS recebem o tag como variável: `image_tag=sha-<commit>`.                    |

## Projetos Nx

Hoje existem `infra-local-platform` (L1) e `infra-local-services` (L4), com `plan`, `apply` e `destroy` sem cache e `fmt`, `validate` e `lint` com cache ([`infra/terraform`](../../infra/terraform/README.md)). Previstos, a implementar:

| Projeto                   | Camada         | Targets         |
| ------------------------- | -------------- | --------------- |
| `infra-<stage>-bootstrap` | L0             | `plan`, `apply` |
| `infra-<stage>-platform`  | L1             | `plan`, `apply` |
| `infra-<stage>-data`      | L2             | `plan`, `apply` |
| `infra-<stage>-services`  | L4 (container) | `plan`, `apply` |
| `infra-<stage>-edge`      | L5             | `plan`, `apply` |

`plan` e `apply` **não usam cache**. As `implicitDependencies` entre projetos (L2 para L1, L4 para L2, L5 para L4) existem só para o grafo e para o `nx affected`: dizem o que foi afetado, e não o que aplicar primeiro.

## Acrescentar um serviço

1. **Decida o dono de cada recurso** com a [regra do ADR 0004](../adr/0004-serverless-e-terraform.md): se o dado sobrevive ao código, ou se mais de um serviço usa, é do Terraform.
2. **Escolha o destino**: Lambda (Serverless) ou container (módulo Terraform), conforme o [ADR 0008](../adr/0008-adapters-de-runtime.md).
3. **Leia o que precisa pelo SSM**, em `/playground/<stage>/<região>/...`, e nunca pelo state de outra camada.
4. **Publique o que outros precisam** (URL da API, ARNs) como parâmetro SSM; o edge e o `contract:check` dependem disso.
5. **Em container**, reserve uma faixa de prioridades de regra no ALB, no registro versionado.
6. **Não crie recurso de L1 ou L2** no serviço, nem dependa de outro serviço.
