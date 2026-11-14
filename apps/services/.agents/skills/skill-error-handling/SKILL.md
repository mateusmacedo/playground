---
name: skill-error-handling
description: >-
  Tratamento de erros nos serviços de `apps/services`: erros de domínio tipados no núcleo (`src/core`, `internal/core`), tradução em resposta HTTP, falha parcial de lote SQS e saída de container nos entrypoints, logs JSON no stdout e nenhum detalhe interno na resposta. Use ao definir erros de domínio, tratar exceção em handler Lambda, mapear erro para status HTTP, devolver `batchItemFailures`, configurar log estruturado ou timeout em chamada externa. NÃO usar para validação do formato dos campos de entrada nem para estados de erro de tela do painel `apps/backoffice`.
---

# Tratamento de erros

**Obrigatório:** toda operação com efeito é segura para rodar mais de uma vez (chave de idempotência, checagem atômica, mesma resposta na repetição) e todo código é projetado para a falha (timeout, retentativa com backoff, circuit breaker, dead letter queue), como definem as seções 3 e 4 da rule global `~/.claude/rules/senior-engineering.md` do mantenedor; os logs seguem os 7 princípios e o checklist da seção 5 da mesma rule. Esta skill detalha a aplicação aqui.

> **Status: padrão a seguir.** Hoje o handler HTTP de `example-ts` (`try/catch`) e o router de `example-go` (`recoverPanic`) só traduzem o erro inesperado em 500 genérico, sem o mapa de `code` para status; só o gerador `--type=sqs` traz `processBatch`, com falha parcial. Os exemplos TypeScript abaixo seguem o estilo de `apps/services/example-ts` (ESM com sufixo `.js`, `type`, funções `const`) e foram verificados com `tsc` estrito e testes no Vitest. O corpo de erro dos templates (`{"error":{"code","message","requestId"}}`, com o 500 como `internal`) está no `AGENTS.md` de `apps/services`; ele **não** está fixado em ADR: alinhe com quem consome (o painel, por exemplo) antes de adotá-lo.

## Princípios

1. **O núcleo diz o que aconteceu; o entrypoint decide o que fazer.** O núcleo lança um erro tipado com um `code`. Status HTTP, falha de item na fila e código de saída do processo são decisão do entrypoint.
2. **Detalhe interno vai para o log, nunca para a resposta.** Stack, mensagem de SDK, SQL e caminhos ficam no log; o cliente recebe `code`, uma mensagem segura e um `requestId`.
3. **Esperado é diferente de inesperado.** Regra de negócio violada vira 4xx e é registrada em `info` ou `warn`; bug ou dependência fora do ar vira 500 e é registrado em `error`. Só o inesperado deve acionar alarme.
4. **Nada de `catch` vazio.** Quem captura trata, relança ou registra.
5. **Uma linha JSON por evento no stdout** (contrato do ADR 0008).

## Erro de domínio no núcleo

Um tipo só, com `code` de uma união fechada, em vez de hierarquia com `statusCode`. Assim o núcleo não conhece HTTP e o TypeScript obriga cada `code` novo a ganhar tradução.

```ts
export type DomainErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'rule_violated';

// WHY: o núcleo só diz o que aconteceu (`code`); quem decide status HTTP,
// retry de fila ou código de saída é o entrypoint.
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DomainError';
    this.code = code;
  }
}

export const notFound = (resource: string, id: string): DomainError =>
  new DomainError('not_found', `${resource} ${id} não encontrado`);

export const invalidInput = (message: string, cause?: unknown): DomainError =>
  new DomainError('invalid_input', message, { cause });
```

- A `message` do `DomainError` é **segura para exibir**: escreva-a para quem consome a API, em PT-BR. Dado interno vai em `cause`, que nunca sai na resposta.
- O caso de uso lança e não captura: `if (!order) throw notFound('Pedido', id)`.
- Exceção para violação e caso inesperado; `Result` quando o chamador precisa ramificar sem `try/catch` (por exemplo, validar cada mensagem de um lote). Não misture os dois no mesmo caso de uso.
- Falha de infraestrutura (SDK, rede) **não** é `DomainError`. O adapter a embrulha em erro próprio, com `cause`, e o entrypoint a trata como inesperada e retentável.
- Entrada que o núcleo recusa vira `invalidInput`; um `JSON.parse` que falha deve ser convertido (`SyntaxError` não é erro de domínio).

## Tradução no entrypoint HTTP

O mapa de `code` para status fica no entrypoint. O `satisfies` faz o `tsc` falhar quando um `code` novo não tem status.

```ts
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { DomainError, type DomainErrorCode } from '../core/errors.js';
import { log } from './logger.js';

const statusByCode = {
  invalid_input: 400,
  not_found: 404,
  conflict: 409,
  rule_violated: 422,
} as const satisfies Record<DomainErrorCode, number>;

const json = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const toErrorResponse = (
  error: unknown,
  requestId: string,
): APIGatewayProxyStructuredResultV2 => {
  if (error instanceof DomainError) {
    return json(statusByCode[error.code], {
      error: { code: error.code, message: error.message, requestId },
    });
  }
  log('error', 'unhandled_error', { requestId, error });
  return json(500, {
    error: { code: 'internal', message: 'Erro interno', requestId },
  });
};
```

O handler só captura e delega, como o `lambda.ts` do `example-ts` faz com o núcleo:

```ts
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const order = await getOrder(orders, event.pathParameters?.id ?? '');
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(order),
    };
  } catch (error) {
    return toErrorResponse(error, event.requestContext.requestId);
  }
};
```

No container (`main-http`, roadmap) vale a mesma ideia com o tratador de erro do framework. Rejeição não tratada e exceção não capturada: registre como fatal e **saia com código diferente de zero**, para o orquestrador reiniciar o processo. O `SIGTERM` não é erro: faça o shutdown gracioso do contrato do ADR 0008 e saia com 0.

## Fila: falha parcial de lote

Lançar do handler reprocessa o lote inteiro. Devolva só os itens que falharam em `batchItemFailures` (o gerador `--type=sqs` já configura `ReportBatchItemFailures` no `serverless.yml`).

```ts
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';

import { DomainError } from '../core/errors.js';
import { log } from './logger.js';

type Handle = (body: string) => Promise<void>;

// WHY: devolver só os ids que falharam reprocessa apenas essas mensagens.
export const toSqsHandler =
  (handle: Handle) =>
  async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const startedAt = Date.now();
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
    for (const record of event.Records) {
      try {
        await handle(record.body);
        log('debug', 'message_processed', { messageId: record.messageId });
      } catch (error) {
        // WHY: entrada inválida é falha esperada e não se resolve repetindo; a
        // mensagem volta para a fila e segue para a DLQ pelo maxReceiveCount.
        const permanent =
          error instanceof DomainError && error.code === 'invalid_input';
        log(permanent ? 'warn' : 'error', 'message_failed', {
          messageId: record.messageId,
          receiveCount: Number(record.attributes.ApproximateReceiveCount),
          permanent,
          error,
        });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    log(batchItemFailures.length === 0 ? 'info' : 'warn', 'batch_completed', {
      total: event.Records.length,
      failed: batchItemFailures.length,
      durationMs: Date.now() - startedAt,
    });
    return { batchItemFailures };
  };
```

- O `lambda.ts` gerado acrescenta o `status` (`completed`, `partial` ou `failed`) ao resumo e o emite num `finally`, para que um erro que escape do laço também apareça como `failed`.
- Mesmo o erro permanente (mensagem inválida) volta como falha: com `maxReceiveCount` e DLQ configurados, ela acaba na DLQ para inspeção, sem se perder e sem travar a fila. Descartar uma mensagem exige regra de negócio explícita e log.
- A entrega é **ao menos uma vez**: o tratamento da mensagem precisa ser idempotente.
- Quem é dono da DLQ segue o ADR 0004: a DLQ da própria função é do Serverless; fila cujas mensagens importam, ou que mais de um serviço usa, é do Terraform.
- No container o worker de long-polling usa o mesmo caso de uso: erro retentável deixa a mensagem na fila (sem `DeleteMessage`); sucesso a apaga.

## Log JSON

O núcleo não loga. O entrypoint (e os adapters) escrevem uma linha JSON por evento no stdout, com o nível lido de `LOG_LEVEL` (o `serverless.yml` do `example-ts` já injeta essa variável).

```ts
type Level = 'debug' | 'info' | 'warn' | 'error';

const weight: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const threshold = (): number =>
  weight[(process.env.LOG_LEVEL as Level | undefined) ?? 'info'] ?? weight.info;

// WHY: `JSON.stringify(new Error())` devolve `{}`; sem o replacer o log de erro
// perderia mensagem e stack.
const replacer = (_key: string, value: unknown): unknown =>
  value instanceof Error
    ? {
        name: value.name,
        message: value.message,
        stack: value.stack,
        cause: value.cause,
      }
    : value;

export const log = (
  level: Level,
  message: string,
  fields: Record<string, unknown> = {},
): void => {
  if (weight[level] < threshold()) return;
  const time = new Date().toISOString();
  // WHY: `fields` vem antes dos campos fixos para não os sobrescrever.
  const entry = { ...fields, level, message, time };
  let line: string;
  try {
    line = JSON.stringify(entry, replacer);
  } catch {
    // WHY: referência circular ou BigInt lançam; o log não derruba o handler.
    line = JSON.stringify({ level, message, time, serializationFailed: true });
  }
  process.stdout.write(`${line}\n`);
};
```

- Inclua o contexto que permite achar o caso: `requestId`, `messageId`, o `code` do erro. O `logger.ts` gerado pelo `service-ts` já guarda o `requestId` da invocação no contexto assíncrono (`withRequestId`) e redige toda chave fora da lista `safeKeys`: chave nova precisa entrar nela.
- **Nunca** registre segredo, token, senha nem dado pessoal. O replacer acima serializa o objeto de erro inteiro: não anexe a ele o corpo da requisição.
- Uma mensagem estável (`unhandled_error`, `message_failed`) e os dados em campos: facilita filtrar.

## Timeout e retry em chamada externa

`AbortSignal.timeout` cancela o `fetch` e rejeita com `TimeoutError` (verificado no Node 24). O timeout da chamada precisa ser **menor** que o da função (`timeout: 29` no HTTP API, que corta em 30 s). O adapter converte qualquer falha em um erro próprio (`DependencyError`) com a `cause` original; o exemplo está em `references/timeout-e-retry.md`.

- Retry só de operação idempotente, com limite e backoff. O AWS SDK já faz retry: ajuste `maxAttempts` em vez de envolver a chamada em outro laço.
- Na fila o retry é da própria fila (reentrega). Não segure o handler em laço de retry por falha longa.

## Go

Erros são valores: `(T, error)`, contexto com `%w`, identidade com `errors.Is` e `errors.As`, e a tradução em `cmd/<svc>`. Veja `references/go.md`.

## Anti-padrões

| Anti-padrão | Correção |
| ----------- | -------- |
| `statusCode` ou tipo de resposta HTTP dentro do erro de domínio | `code` no núcleo; o mapa de status no entrypoint |
| Mensagem de exceção do SDK na resposta ao cliente | Mensagem genérica, `requestId` e o detalhe no log |
| `catch (e) {}` ou `catch` que só devolve `null` | Tratar, relançar ou registrar |
| Lançar do handler SQS por uma mensagem ruim | `batchItemFailures` só com os ids que falharam |
| `console.log` de texto livre | Uma linha JSON no stdout |
| `JSON.stringify(error)` direto | Serializar `name`, `message`, `stack` e `cause` |
| Erro de domínio esperado logado como `error` | `info` ou `warn`; `error` é para o inesperado |
| Retry em laço dentro do handler | Retry da fila, ou `maxAttempts` do SDK |

## Checklist

- [ ] Erros de domínio com `code` e sem status HTTP; mensagem segura para exibir.
- [ ] Todo `code` tem tradução (o `tsc` garante com `satisfies`).
- [ ] Erro inesperado: 500 genérico com `requestId`, detalhe só no log.
- [ ] Lote SQS devolve `batchItemFailures`; tratamento idempotente; DLQ com o dono certo.
- [ ] Logs em JSON no stdout, sem segredo nem dado pessoal.
- [ ] Chamada externa com timeout menor que o da função.
- [ ] Nenhum `catch` vazio.

## Veja também

- `references/go.md` (erros em Go) e `references/timeout-e-retry.md`.
- `docs/adr/0008-adapters-de-runtime.md` (contrato de container e logs JSON) e `docs/adr/0004-serverless-e-terraform.md` (dono da fila e da DLQ).
- `docs/guides/servico-serverless.md` (tipo `sqs`) e as skills `skill-ddd` e `skill-architecture-patterns`.
