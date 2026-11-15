# ADR 0004: Serverless Framework v4 e Terraform, quem é dono de quê

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

A infraestrutura é **compartilhada** entre dois mecanismos: os manifestos do **Serverless Framework v4** e o **Terraform**. O backend é serverless por preferência, mas pode rodar também em container (ECS, EKS ou EC2), conforme o [ADR 0008](./0008-adapters-de-runtime.md). Sem uma fronteira escrita, cada recurso novo reabre a discussão "isto é do serviço ou da plataforma?", e o mesmo recurso acaba declarado nos dois lugares.

Precisamos de três coisas: uma regra que dê a resposta sem debate, um contrato para um lado descobrir o que o outro criou, e a garantia de que um `serverless remove` nunca apague dado.

## Decisão

### 1. Quem é dono de quê

| Ferramenta                  | Cuida de                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Terraform**               | A plataforma (rede, ECR, clusters ECS e EKS, EC2 e ASG, ALB, CloudFront, Cognito, RDS e IAM base), tudo que guarda dado ou é compartilhado, e os backends em container. |
| **Serverless Framework v4** | As funções Lambda de cada serviço e os eventos que as disparam.                                                                                                         |

Nos destinos de container, os recursos do serviço ficam em módulo Terraform (ou chart), e não no `serverless.yml`. Cada recurso tem **um único dono**.

### 2. Regra de dono, aplicada em ordem

A **primeira regra que casar** define o dono.

| #   | Pergunta                                                                                                                                                                          | Se sim                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | O dado sobrevive ao código (tabela, bucket, user pool, fila cujas mensagens importam)?                                                                                            | **Terraform**. Um `sls remove` nunca apaga dado.                    |
| 2   | O recurso é usado por 2 ou mais serviços (barramento, fila de integração, tópico)?                                                                                                | **Terraform**                                                       |
| 3   | É fundação de rede, segurança ou identidade (VPC, security groups, KMS, IAM base, Cognito, ACM, Route 53, WAF)?                                                                   | **Terraform**                                                       |
| 4   | É backend em container, nos estágios EC2, ECS ou EKS?                                                                                                                             | **Terraform**, módulos `service-ec2`, `service-ecs` e `service-eks` |
| 5   | Pertence 1:1 a uma Lambda e pode morrer com ela (função, role de permissões mínimas, gatilhos, DLQ e destino de falha da própria função, retenção de logs, alias e concorrência)? | **Serverless**                                                      |

Exemplos:

| Recurso                                 | Dono                                      |
| --------------------------------------- | ----------------------------------------- |
| DynamoDB de pedidos e bucket de uploads | Terraform                                 |
| Fila SQS usada por 2 serviços           | Terraform (a Lambda só declara o gatilho) |
| HTTP API de um serviço Lambda           | Serverless (uma por serviço)              |
| Domínio customizado, CloudFront e WAF   | Terraform, camada edge                    |
| ALB, target groups, ECR, ECS e EKS      | Terraform                                 |
| Role da Lambda                          | Serverless, lendo os ARNs do SSM          |

### 3. O contrato entre os dois: só pelo SSM

Um lado **nunca** lê o state do outro.

- O Terraform **publica** os outputs com `aws_ssm_parameter` em `/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`.
- O Serverless **lê** com `${ssm:/playground/${sls:stage}/${aws:region}/...}`.
- O Serverless **publica** a URL da API e os ARNs como `AWS::SSM::Parameter` em `resources`, para a camada edge do Terraform consumir.

```text
/playground/local/us-east-1/backoffice/app/name
```

`stage` é um de `local`, `dev`, `homolog` ou `prod` (os valores do `AppStage` do backoffice).

O `${terraform:outputs}` do Serverless foi **rejeitado**: ele não lê state local, e o ambiente `local` precisa funcionar assim.

**A implementar:** um target Nx `contract:check` que falha quando algum `${ssm:...}` usado em um `serverless.yml` não existe no catálogo de parâmetros publicado pelo Terraform.

### 4. Estrutura e ordem de deploy

**A criar** (nada disto existe ainda):

```text
infra/terraform/modules/*
infra/terraform/envs/<stage>/{platform,services,edge}
apps/services/<svc>/serverless.yml
```

No `envs/local`, o provider do Terraform aponta para o Floci. A ordem de deploy é **plataforma, depois serviços (Serverless e o `services` do Terraform), depois edge**, e cada camada é um projeto Nx com `plan` e `apply` sem cache. O detalhamento das camadas e das fases está no [ADR 0009](./0009-camadas-e-ordem-de-implantacao.md).

### 5. O ambiente local segue o mesmo contrato

No Floci ([ADR 0002](./0002-floci-ambiente-aws-local.md)), o `envs/local` do Terraform passa a criar a plataforma local. O bootstrap de `infra/local` fica só com o que o Terraform não fizer no emulador. **Hoje**, enquanto o Terraform não existe, o bootstrap publica os parâmetros SSM e cria os recursos iniciais.

### 6. Rejeitado

- **API Gateway único e compartilhado, no Terraform**: acopla os deploys de serviços diferentes ao mesmo recurso.
- **`${terraform:outputs}` no Serverless**: não lê state local.
- **Leitura cruzada de state** (`terraform_remote_state` ou equivalente): o SSM é a única interface.

## Consequências

- **Ganhos**: a pergunta de dono tem resposta derivável; `sls remove` não destrói dado; serviços testáveis localmente com o mesmo contrato da nuvem.
- **Hoje**: o Terraform existe só para o ambiente local (`infra/terraform`: plataforma L1 e serviços de container L4, [ADR 0011](./0011-estrutura-profissional-do-terraform.md)). Fila, tabela e bucket compartilhados ainda vêm do seed do `infra/local`, e o deploy na AWS espera os gatilhos do ADR 0011.
- **Regra de trabalho**: serviço que precisa de um recurso de dono Terraform muda dois lugares no mesmo PR, o módulo (ou o seed local, para dado compartilhado que o Terraform local ainda não cria) e o `serverless.yml` que lê o parâmetro. O SSM é o que os une.
- **Filas nos geradores**: o `--type=sqs` usa `--queue=external` por padrão. A fila e a redrive policy são do Terraform (ou, no Floci, do bootstrap), o serviço só declara o gatilho e lê o ARN e a URL do SSM, o deploy falha se o contrato não existir e o `remove` preserva a fila. `--queue=owned` cria a fila e a DLQ no `serverless.yml` e só serve para fila descartável de um único consumidor. `--queueParam=<domínio>/<recurso>` aponta o serviço para um contrato compartilhado, como `shared/sample-events-queue`.
- **Custos**: o valor de um parâmetro pode divergir entre local e nuvem; o `contract:check` existe para pegar a divergência de **nome**.
- **Segredos**: os parâmetros do bootstrap são `String`, sem criptografia. Segredos ficam no Secrets Manager.
- **Gatilho de revisão**: um recurso que não se encaixe em nenhuma das cinco regras.
