# apps/services: instruções para agentes

Serviços serverless de exemplo: `example-ts` (TypeScript), `example-go` (Go) e `example-quarkus` com `example-quarkus-core` (Java com Quarkus). Este arquivo vale para todos os serviços; cada um tem o seu `AGENTS.md` com o que é só dele. As convenções gerais estão no [`AGENTS.md`](../../AGENTS.md) da raiz e não se repetem aqui.

## Assets de IA deste escopo

- Rules (`.agents/rules/`, carregam pelos `paths:`): `services-go` (Go), `services-typescript` (TypeScript) e `services-errors` (erros no núcleo e nos entrypoints, em qualquer linguagem).
- Skills (`.agents/skills/`): `skill-go`, `skill-go-http-patterns`, `skill-go-db-patterns`, `skill-go-queue-patterns`, `skill-go-testing`, `skill-ddd`, `skill-error-handling` e `skill-nestjs-patterns` (padrão para quando houver NestJS, que ainda é roadmap).

## Serviço novo e `serverless.yml`

- Serviço novo nasce do generator do plugin local: `pnpm nx g ./tools/serverless:service-ts <nome> --type=http|sqs|scheduled` (ou `service-go`). Rode com `--dry-run` antes. Para Java ainda **não existe** o `service-java`: parta do `example-quarkus`. Detalhes no [guia](../../docs/guides/servico-serverless.md).
- Todo `serverless.yml` declara `custom.nxServerless` (linguagem e tipo); sem isso o plugin não infere os targets.
- Dono de cada recurso, pela regra do [ADR 0004](../../docs/adr/0004-serverless-e-terraform.md): o `serverless.yml` declara só o que pertence 1:1 à Lambda e pode morrer com ela. No tipo `sqs`, o gerador usa `--queue=external` por padrão (o serviço só declara o gatilho e lê ARN e URL da fila do SSM); `--queue=owned` cria fila e DLQ no serviço e só serve para fila descartável de um único consumidor.

## Núcleo e entrypoints ([ADR 0008](../../docs/adr/0008-adapters-de-runtime.md))

| Camada                          | TypeScript                                                              | Go               | Pode importar                                     |
| ------------------------------- | ----------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| Núcleo (domínio e casos de uso) | `src/core/`                                                             | `internal/core/` | Só a linguagem e outros arquivos do núcleo        |
| Entrypoints                     | `src/entrypoints/` (`lambda.ts`, e `main-http` quando houver container) | `cmd/<serviço>/` | O núcleo e a biblioteca de runtime (Lambda, HTTP) |

- **OBRIGATÓRIO**: domínio e casos de uso **puros**. O núcleo não importa framework de runtime (`aws-lambda`, `fastify`, `net/http`, `aws-lambda-go`, Quarkus), SDK da AWS nem lê `process.env` ou `os.Getenv`. O entrypoint traduz evento ou requisição, chama o caso de uso e traduz o resultado.
- Entrypoints finos por runtime, com detecção por `AWS_LAMBDA_RUNTIME_API` (referência: `example-go/cmd/example-go/runtime.go`, que escolhe Lambda ou HTTP). O Go tem o modo HTTP na partida, e o Quarkus escolhe o runtime **no build** (`-Pruntime=lambda`, o padrão, ou `-Pruntime=container`).
- NestJS e o adapter `main-http` em TS ainda são **roadmap**: não escreva código que suponha que existem.
- Contrato de execução: `PORT`, health em `/health`, logs JSON no stdout, shutdown gracioso no `SIGTERM`, serviço stateless e configuração por variável de ambiente e SSM. Consumidor de fila tem dois drivers (lote na Lambda, long-polling no container) sobre o **mesmo** caso de uso.
- Formato mínimo do log (TypeScript, Go e Quarkus): `time`, `level` em minúsculas, `message` e `requestId`, quando houver; o `requestId` vem do logger (id da invocação da Lambda, ou `X-Request-Id` e um id gerado no container). Campo fora da lista de chaves seguras do logger sai como `[redacted]`. No Quarkus a chave é renomeada, mas o nível sai em maiúsculas e o id da invocação fica em `mdc.AWSRequestId`.
- Corpo de erro HTTP (templates TypeScript e Go): `{"error":{"code","message","requestId"}}`, com `code` estável, mensagem em PT-BR segura para exibir e o detalhe só no log; o 500 é `internal` com `Erro interno`, e o `requestId` é o mesmo do log. Em Go, o `writeError` do `runtime.go` o escreve; os testes dos templates o fixam.
- Dependência de infraestrutura entra no núcleo como **porta** (interface ou `type` de função) e é montada no entrypoint. Sem container de DI no núcleo.
- Serviço não importa outro serviço. O que dois serviços compartilham vira lib em `packages/` (gerador do Nx) ou recurso do Terraform em L2.
- Configuração: leia o ambiente em **um** ponto do entrypoint, valide na partida e falhe cedo se faltar item obrigatório. Não logue a configuração.

## Estrutura

```text
<svc>/ (TypeScript)
  serverless.yml                declara custom.nxServerless
  src/core/                     núcleo puro, com *.spec.ts ao lado
  src/entrypoints/lambda.ts     traduz evento e chama o núcleo
<svc>/ (Go)
  internal/core/                núcleo puro, com *_test.go ao lado
  cmd/<svc>/                    main, runtime e router
```

O Java tem a estrutura no `AGENTS.md` do `example-quarkus`.

## Imagens de container

Detalhes e decisões no [guia](../../docs/guides/imagens-de-container.md).

- `example-go` e `example-quarkus` têm imagem OCI, com o `Dockerfile` na pasta do serviço; o TypeScript ainda não tem (o `main-http` em TS é roadmap).
- Use os targets do Nx `docker:build`, `docker:run` e `docker:push-floci` (este publica no ECR do Floci, no repositório `playground-<projeto>`). Não rode `docker build` direto: o `@nx/docker` inferiria o contexto errado, e os `project.json` o sobrescrevem.
- O contexto do build é a raiz do workspace, com o `.dockerignore` da raiz. A tag é única, de `bash tools/container/image-tag.sh`, e serve para build, push e Terraform: a imagem é construída uma vez e promovida sem rebuild ([ADR 0008](../../docs/adr/0008-adapters-de-runtime.md)).

## Performance

Lambda:

- Inicialização **fora do handler**: cliente do SDK, conexão e configuração são criados uma vez e reaproveitados entre invocações.
- Bundle enxuto: SDK v3 por pacote (`@aws-sdk/client-sqs`, não o agregado), sem dependência só de desenvolvimento no pacote. Cold start cresce com o tamanho.
- `arm64` e memória como o gerador define (`memorySize`, `timeout` no `serverless.yml`). Mais memória também dá mais CPU: ajuste por medição.
- `timeout` da função HTTP abaixo do limite de 30 s do API Gateway (o exemplo usa 29 s).
- Fila: `VisibilityTimeout` de pelo menos 6x o timeout da função, tamanho de lote e concorrência ajustados ao tipo de trabalho, e `batchItemFailures` para não reprocessar o lote inteiro.

Container (EC2, ECS, EKS):

- Serviço sem estado, com pool de conexões dimensionado por réplica e `http.Client` (ou agente HTTP) **reaproveitado**, sempre com timeout.
- Cache em memória é **por instância**: serve para dado imutável ou de TTL curto; coerência entre réplicas é problema seu.
- Shutdown gracioso no `SIGTERM` para não perder requisição durante o blue/green do ALB.

Dados: o dado é do Terraform (L2) e o serviço só consome; o resto está na rule `performance` da raiz.
