# ADR 0008: Adapters de runtime para portabilidade Lambda, ECS, EKS e EC2

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O backend é **serverless por preferência**, mas o mesmo código-fonte precisa rodar em **Lambda, ECS, EKS ou EC2**, por **opção de deploy**, sem reescrever o serviço. O modelo é **evolutivo e incremental**: começa com poucos backends em EC2 e Lambdas, cresce para ECS e escala para EKS. Para migrar de um destino a outro sem tocar no código, o serviço não pode depender do ambiente em que roda.

Todos esses destinos rodam localmente no Floci ([ADR 0002](./0002-floci-ambiente-aws-local.md)).

## Decisão

**Entrypoints nativos, com detecção automática do runtime.**

- **Domínio e casos de uso puros**: nenhum import de framework de runtime (Lambda, servidor HTTP) neles.
- **Entrypoints finos por serviço**: `main-http` (container) e `main-lambda` (Lambda). O binário ou a imagem escolhe o modo pela presença da variável `AWS_LAMBDA_RUNTIME_API`. No Quarkus, a escolha é pela extensão no build.
- **Pontes por stack**:

| Stack   | Ponte                                                                 |
| ------- | --------------------------------------------------------------------- |
| Node    | `@fastify/aws-lambda`, ou `@codegenie/serverless-express` para o Nest |
| Quarkus | `quarkus-amazon-lambda-http`, com o mesmo código JAX-RS               |
| Go      | `aws-lambda-go-api-proxy`                                             |

- **Consumidores de fila** têm dois drivers: o handler de lote na Lambda e o worker de long-polling no container.

### Alternativas rejeitadas

| Alternativa            | Motivo                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lambda Web Adapter** | Só funciona com imagem de container, tem cold start maior e depende de suporte do Floci a extensões de Lambda, que ainda não foi verificado. |
| **Híbrido**            | Dois modelos convivendo no mesmo repositório.                                                                                                |

### Invariantes que permitem migrar sem mudar o código

- **Artefato único por serviço**: uma imagem OCI construída **uma vez** e que recebe a tag imutável **`sha-<commit>`**, usada para promover entre ambientes e em EC2, ECS e EKS. O zip continua sendo o artefato da Lambda. No release, o **mesmo digest** ganha também a tag semântica `<versão>` como alias, **sem rebuild** ([ADR 0010](./0010-versionamento-e-publicacao-no-github.md)): as duas tags apontam para a mesma imagem.
- **Configuração** por variável de ambiente e pelo SSM canônico ([ADR 0004](./0004-serverless-e-terraform.md)); **segredos** no Secrets Manager.
- Contrato de execução: `PORT`, health em `/health`, logs JSON no stdout, shutdown gracioso no `SIGTERM` e serviço **stateless**.

### Estágios de evolução

| Estágio | Quando      | Backends                                                                                                                                             | Lambdas               |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **1**   | Início      | 2 a 3 backends, cada um em uma EC2 micro própria (ASG de 1 instância por serviço), atrás de **um ALB compartilhado** com roteamento por path ou host | 1 a 2, via Serverless |
| **2**   | Crescimento | Os backends migram de EC2 para **tasks ECS** no mesmo ALB (target groups novos)                                                                      | Seguem                |
| **3**   | Escala      | Os serviços migram para **EKS**, com ingress próprio                                                                                                 | Seguem                |

A migração entre estágios é **blue/green no ALB**, com target groups ponderados: sobe o novo, desloca o peso e desliga o antigo.

### Dono da infra por estágio

| Destino       | Dono                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| EC2, ECS, EKS | **Terraform**: módulos `service-ec2`, `service-ecs` e `service-eks`, mais a plataforma |
| Lambda        | **Serverless**                                                                         |

O plugin Nx escolhe o deploy pelo **destino declarado no projeto**.

## Consequências

- **Ganhos**: o mesmo código vai para Lambda ou container por opção de deploy; a migração entre estágios não exige mudar o serviço; o domínio fica testável sem framework.
- **Custos**: cada serviço mantém dois entrypoints finos e, quando consome fila, dois drivers. As pontes por stack viram dependência.
- **Hoje**: **parcialmente implementado.** Os templates dos generators já separam o núcleo do entrypoint. Em **Go**, o `cmd/<nome>/runtime.go` escolhe Lambda ou HTTP por `AWS_LAMBDA_RUNTIME_API` (HTTP com `PORT`, `GET /health` e `SIGTERM` limpo, e o mesmo router nos dois modos pelo `aws-lambda-go-api-proxy`). Em **Java (Quarkus)**, o `example-quarkus` separa o núcleo em Java puro (`example-quarkus-core`, sem Quarkus no classpath) da aplicação, e escolhe o runtime **no build**: `-Pruntime=lambda` (o padrão, com `quarkus-amazon-lambda-http`, artefato `function.zip`) ou `-Pruntime=container` (sem a extensão, artefato `quarkus-run.jar` que sobe como servidor HTTP com `PORT`, `/health` e `SIGTERM` limpo). O artefato de Lambda só roda dentro dela. Em **TypeScript**, o núcleo fica em `src/core` e só existe o entrypoint de Lambda (`src/entrypoints/lambda.ts`). **Não existem**: imagem OCI, entrypoint de container em TypeScript, a escolha de destino pelo plugin Nx nem módulos Terraform. O health do contrato é `/health` em todas as stacks. Ainda **não há imagem OCI do Quarkus**: o modo `container` gera só o JAR.
- **Pendência resolvida (PoC no Floci 2.4.0, 2026-11-14)**: a instância EC2 do Floci é um container privilegiado, e o Docker aninhado roda a imagem do serviço com `tmpfs` em `/var/lib/docker`. O estágio 1 usa o mesmo artefato (`<repositório>:sha-<commit>`, mesmo digest) de ECS e EKS, e o invariante do artefato único se mantém; o fallback com systemd não foi preciso ([módulo `service-ec2`](../../infra/terraform/modules/service-ec2/README.md)).
- **Próximo passo**: uma PoC com um serviço Node no Floci, com deploy em Lambda (zip) e em ECS (imagem), com o mesmo código.
- **Gatilho de revisão**: a PoC mostrar que o Floci não suporta a rota, ou uma ponte por stack deixar de ser mantida.
