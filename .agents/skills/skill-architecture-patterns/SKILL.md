---
name: skill-architecture-patterns
description: >-
  Arquitetura dos serviços do playground: hexagonal (núcleo puro, portas e adapters), entrypoints nativos por runtime (Lambda e `main-http`), camadas L0 a L6 com dono único Serverless x Terraform, contrato via SSM e a regra de que serviços não dependem de serviços. Use ao decidir onde colocar código ou recurso em `apps/services`, `src/core`, `src/entrypoints`, `internal/core`, `cmd/<svc>`, `serverless.yml` ou Terraform, ao definir fronteiras entre camadas e ao ligar portas a adapters. NÃO usar para evolução e migração de estágio (use skill-evolutionary-architecture) nem para modelagem do domínio (use skill-ddd).
---

# Padrões de arquitetura

> **Status misto.** O **núcleo puro** e o **entrypoint Lambda** existem em `apps/services/example-ts` e `example-go`. Os **adapters de runtime** (`main-http` e `main-lambda`), as **camadas L0 a L6**, o **Terraform** e o `contract:check` são **roadmap** (ADR 0008 e 0009, com PoC pendente): trate-os como padrão a seguir e não escreva código que suponha que existem. Este documento resume as decisões e aponta para os ADRs; não os copia.

## Quando usar

- Decidir onde um código novo mora: núcleo, entrypoint ou adapter.
- Decidir quem é dono de um recurso: Serverless ou Terraform.
- Ligar uma porta a uma implementação, ou ler configuração do ambiente.
- Revisar se um serviço respeita as fronteiras de camada.

## Hexagonal no repositório

```text
 entrypoints (entrada)                   adapters (saída)
 Lambda:    src/entrypoints/lambda.ts    DynamoDB, SQS, S3, SSM,
 Container: main-http (roadmap)          clientes HTTP
 Go:        cmd/<svc>                          ^ implementam as portas
        |                                      |
        v                                      |
 +----------------------------------------------------------+
 |  núcleo: src/core (TS) ou internal/core (Go)             |
 |  casos de uso -> domínio (agregados, VOs, eventos, erros)|
 |  portas: type (TS) ou interface (Go) que o núcleo declara|
 +----------------------------------------------------------+
```

| Peça | TypeScript | Go | Status |
| ---- | ---------- | -- | ------ |
| Núcleo | `src/core/` | `internal/core/` | Existe |
| Entrypoint Lambda | `src/entrypoints/lambda.ts` | `cmd/<svc>/main.go` com `lambda.Start` | Existe |
| Entrypoint de container | `main-http` (arquivo em `src/entrypoints/`) | `serve` em `cmd/<svc>/runtime.go` | Go existe no exemplo; TS é roadmap |
| Adapters de saída | `src/adapters/` | `internal/adapters/` | Padrão a seguir (os exemplos não têm I/O) |

Os nomes das pastas de adapters não estão fixados em ADR: escolha um e mantenha igual em todos os serviços.

### Regra de dependência

| Pasta | Pode importar | Não pode importar |
| ----- | ------------- | ----------------- |
| Núcleo | só ele mesmo e a biblioteca padrão ou libs puras | `aws-lambda`, SDK da AWS, framework HTTP, `entrypoints/`, `adapters/` |
| Adapters | o núcleo (para implementar as portas) | `entrypoints/` |
| Entrypoints | núcleo e adapters (é a raiz de composição) | nada é proibido, mas não contêm regra de negócio |

O `src/core` do `example-ts` não importa nem os tipos de `aws-lambda`; o `internal/core` do `example-go` só importa a biblioteca padrão. A fiscalização automática dessa regra é um padrão a seguir (veja a seção de fitness functions da skill `skill-evolutionary-architecture`). No Go o ciclo de import é erro de compilação; no TypeScript o Biome já trata `noImportCycles` como erro.

## Entrypoints nativos por runtime (ADR 0008)

O mesmo serviço vai para Lambda, ECS, EKS ou EC2 por **opção de deploy**. Cada runtime tem um entrypoint fino e nativo; o núcleo não muda. Pontes por stack, conforme o ADR:

| Stack | Ponte HTTP para a Lambda |
| ----- | ------------------------ |
| Node | `@fastify/aws-lambda`; no Nest, `@codegenie/serverless-express` |
| Go | `aws-lambda-go-api-proxy` (`httpadapter.NewV2`) |
| Quarkus | `quarkus-amazon-lambda-http`, escolhido no build (`-Pruntime=lambda\|container`; veja `apps/services/example-quarkus`) |

O `example-go` é a referência mais próxima: o mesmo `router` atende os dois modos, e o `main` escolhe pela presença de `AWS_LAMBDA_RUNTIME_API`:

```go
func main() {
	router := newRouter()
	if runningOnLambda() {
		lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
		return
	}
	serve(router)
}
```

Em TypeScript, o `lambda.ts` do `example-ts` recebe o evento do HTTP API e chama o núcleo diretamente, sem framework HTTP. Para Node em container, o ADR não fixa como a imagem escolhe o modo; confirme na PoC antes de afirmar.

### Contrato de execução de container

`PORT`, health em `/health`, **logs JSON no stdout**, **shutdown gracioso** no `SIGTERM` e serviço **stateless**. Configuração por variável de ambiente e SSM; segredos no Secrets Manager. Estado que precisa sobreviver vai para um recurso de L2, nunca para disco ou memória da instância.

### Consumidor de fila: dois drivers, um caso de uso

| Driver | Onde | Papel |
| ------ | ---- | ----- |
| Handler de lote | Lambda | Recebe o `SQSEvent`, chama o núcleo e devolve `batchItemFailures` |
| Worker de long-polling | Container | Faz `ReceiveMessage` na fila e chama o **mesmo** caso de uso |

O gerador `service-ts --type=sqs` (e o `service-go`) traz o handler de lote e o caso de uso `processBatch` no núcleo; o worker de container é roadmap. Teste os dois drivers.

## Composição e injeção de dependência

O **entrypoint é a raiz de composição**: lê o ambiente, cria os adapters e passa as dependências ao caso de uso. DI manual é o padrão: explícita, rastreável e sem container no núcleo. Container de DI (Nest) só entra nas camadas de adapter, nunca no núcleo (veja `skill-nestjs-patterns`).

```ts
// WHY: ler o ambiente em um só lugar e falhar cedo evita `undefined` chegando
// ao núcleo e erro de configuração só em produção.
export const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
};

export const loadConfig = () => ({
  ordersTable: requireEnv('ORDERS_TABLE'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
});
```

`process.env` só aparece no entrypoint. No `example-ts`, `LOG_LEVEL` chega pelo `serverless.yml` (`environment`, lendo o SSM) e não é lido pelo núcleo.

## Camadas L0 a L6 e dono único (ADR 0009 e 0004)

**Roadmap.** Só o `infra-local` (Floci) e o deploy Serverless no Floci existem. A tabela resume; o detalhe (escopo, proibições, fases, promoção) está em `docs/adr/0009-camadas-e-ordem-de-implantacao.md`.

| Camada | Dono | Regra de bolso |
| ------ | ---- | -------------- |
| L0 bootstrap | Terraform | State, OIDC e budgets; uma vez por ambiente |
| L1 platform | Terraform | Rede, ECR, clusters, ALB, Cognito, KMS |
| L2 data | Terraform | Tudo stateful ou compartilhado: tabelas, buckets, filas, tópicos |
| L3 artefatos | Build do Nx | Zip e imagem OCI por SHA; não cria infraestrutura |
| L4 serviços | Serverless (Lambda) ou Terraform `services` (container) | Função, rotas, gatilhos, role, target group; não cria L1 nem L2 |
| L5 edge | Terraform | CloudFront, domínios, WAF; roda depois dos serviços |
| L6 verificação | Nx e CI | Smoke e `contract:check` |

A dependência só aponta para camadas de **número menor** (L5 usa L4, nunca o contrário), sempre pelo SSM canônico. O frontend Next é um serviço de L4.

### Quem é dono do recurso

A **primeira** regra que casar decide (ADR 0004):

1. O dado sobrevive ao código (tabela, bucket, fila cujas mensagens importam)? Terraform.
2. Mais de um serviço usa o recurso (barramento, fila de integração, tópico)? Terraform.
3. É fundação de rede, segurança ou identidade? Terraform.
4. É backend em container? Terraform.
5. Pertence 1:1 a uma Lambda e pode morrer com ela (função, role, gatilhos, DLQ da própria função, retenção de logs)? Serverless.

Serviço que precisa de recurso de dono Terraform muda **dois lugares no mesmo PR**: o módulo (ou o seed de `infra/local` enquanto o Terraform não existe) e o `serverless.yml` que lê o parâmetro.

### Contrato só pelo SSM

Um lado **nunca** lê o state do outro. O caminho é `/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`, e o `serverless.yml` lê assim:

```yaml
environment:
  LOG_LEVEL: ${ssm:/playground/${sls:stage}/${aws:region}/example-ts/log-level, 'info'}
```

O `contract:check`, que falharia quando um `${ssm:...}` não existe no catálogo, é roadmap.

### Serviços não dependem de serviços

Um serviço de L4 não chama, importa nem depende de outro de L4. O que é compartilhado mora em L2 (fila, tópico, barramento, tabela), e a conversa entre serviços é por **evento** nesse recurso. Código reutilizável entre serviços vira lib em `packages/`, ligada por dependência de workspace do pnpm.

## Anti-padrões

| Anti-padrão | Correção |
| ----------- | -------- |
| Regra de negócio no handler ou no router | Mover para o núcleo; o entrypoint só traduz |
| Núcleo importando `aws-lambda`, SDK ou framework HTTP | Declarar uma porta e implementá-la em um adapter |
| `process.env` espalhado pelo código | Ler em um ponto do entrypoint e passar a configuração |
| Estado em disco ou na memória da instância | Usar recurso de L2 (o serviço é stateless) |
| Recurso compartilhado declarado no `serverless.yml` | É do Terraform (regras 1 e 2 do ADR 0004) |
| Ler `terraform_remote_state` ou o state do outro lado | Ler só o parâmetro SSM |
| Serviço chamando outro serviço direto | Evento em recurso compartilhado de L2 |
| Entrypoint Lambda e entrypoint de container com lógica duplicada | Uma função no núcleo, dois entrypoints finos |

## Checklist

- [ ] Núcleo sem import de runtime; entrypoint sem regra de negócio.
- [ ] Portas declaradas no núcleo e implementadas fora dele.
- [ ] Configuração lida só no entrypoint, falhando cedo se faltar.
- [ ] Cada recurso tem um único dono, decidido pela regra em ordem do ADR 0004.
- [ ] Contrato entre Terraform e Serverless só por SSM, no caminho canônico.
- [ ] Serviço não depende de outro serviço.
- [ ] Nada do roadmap tratado como existente.

## Veja também

- `docs/adr/0008-adapters-de-runtime.md`, `docs/adr/0004-serverless-e-terraform.md` e `docs/adr/0009-camadas-e-ordem-de-implantacao.md`.
- `docs/architecture/overview.md`, `docs/guides/servico-serverless.md` e `docs/guides/ordem-de-implantacao.md`.
- Referências de código: `apps/services/example-ts` (`src/core`, `src/entrypoints`) e `apps/services/example-go` (`internal/core`, `cmd/example-go`).
- Skills `skill-evolutionary-architecture`, `skill-ddd` e `skill-nestjs-patterns`.
