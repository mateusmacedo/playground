---
name: skill-nestjs-patterns
description: >-
  Padrão a seguir para serviços NestJS no playground, que ainda não existem: Nest hexagonal com núcleo puro (`src/core`), módulos por contexto, injeção de portas por token, filtro de erro de domínio, entrypoints `main-http` (container) e `main-lambda` (ponte `@codegenie/serverless-express`) e testes com Vitest. Use ao criar ou revisar código NestJS (módulos, providers, controllers, pipes, guards, exception filters), ao configurar decoradores com Vitest, Biome ou esbuild, ou ao ligar o Nest à Lambda. NÃO usar para o formato dos erros em si (use skill-error-handling) nem para a estrutura geral de camadas (use skill-architecture-patterns).
---

# NestJS: padrão a seguir

> **Status: roadmap, ainda não existe no repositório.** Não há NestJS em nenhum projeto; o ADR 0008 prevê Nest com `@codegenie/serverless-express`, e os adapters de runtime estão com a PoC pendente. Tudo aqui é **padrão a seguir**. Os trechos foram verificados em um projeto de teste **fora do repositório** (Nest 12.5.0, `@codegenie/serverless-express` 5.0.0, Vitest 5.0.5, Vite 8.3.8, TypeScript 6.0.3, Node 24): compilam em `strict`, passam no Vitest e o `main-http` sobe, responde `/health`, emite log JSON e encerra no `SIGTERM`. O que **não** foi verificado está marcado.

## Quando usar

- Criar um serviço, módulo, provider, controller, pipe, guard ou exception filter em NestJS.
- Configurar decoradores no Vitest, no Biome ou no bundle do Serverless.
- Ligar o Nest à Lambda ou ao container.

## A ideia

O Nest é um **adapter de entrada**, não a casa da regra de negócio. O domínio e os casos de uso ficam em `src/core`, sem import de `@nestjs/*` (ADR 0008), exatamente como no `example-ts`. O Nest cuida de HTTP, módulos, injeção de dependência e ciclo de vida.

```text
apps/services/<nome>/
  serverless.yml              custom.nxServerless (language: typescript)
  src/
    core/                     núcleo puro: domínio, casos de uso, portas (zero @nestjs)
    adapters/                 implementações das portas (DynamoDB, SQS, clientes HTTP)
    http/                     controllers, filtros, pipes, guards (borda do Nest)
    <contexto>/               um módulo Nest por contexto: tokens e composição
    app.module.ts             composition root: junta os módulos de contexto
    main-http.ts              container: NestFactory.create e listen(PORT)
    main-lambda.ts            Lambda: ponte serverless-express
```

`apps/services/<nome>` já está nos globs do workspace pnpm. Projeto novo nasce de gerador (skill `nx-generate`; para o plugin do Nest veja `nx-plugins`). Uma opção, **não verificada**, é gerar a base com `service-ts --type=http --dry-run` (traz `tsconfig`, `vitest.config.mts` e `serverless.yml`) e acrescentar o Nest. Dependências novas entram no catálogo (`catalog:`): `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing`, `@codegenie/serverless-express`, `reflect-metadata` e `rxjs` (peers do Nest 12).

## Decoradores: três ferramentas, um comportamento

O Nest usa decoradores legados (`experimentalDecorators`). O que muda de ferramenta para ferramenta é o **metadata de tipo** (`emitDecoratorMetadata`), que o Nest usa para injetar por tipo:

| Ferramenta | Emite metadata de tipo? |
| ---------- | ----------------------- |
| `tsc` | Sim, com `emitDecoratorMetadata: true` |
| Vitest 5 com Vite 8 (Oxc) | Sim, segue o `tsconfig` (verificado); a receita oficial do Nest usa `unplugin-swc` |
| esbuild (o bundle do Serverless v4) | **Não**: os decoradores compilam, mas o metadata é omitido silenciosamente |

Se teste e produção diferem, o teste passa e a Lambda quebra. Foi o que se observou: um filtro com `constructor(private readonly host: HttpAdapterHost)` funcionou no Vitest e, no bundle do esbuild, `host` ficou `undefined` e todo erro de domínio virou 500. A regra para evitar:

1. **Toda injeção é explícita com `@Inject(token)`**, inclusive de classes do Nest (`@Inject(HttpAdapterHost)`). Portas são `type`s e não existem em runtime, então já exigem token.
2. **`"emitDecoratorMetadata": false`** (mantenha `"experimentalDecorators": true`) nos `tsconfig.app.json` e `tsconfig.spec.json`. Assim o Vitest se comporta como o bundle e um `@Inject` esquecido **falha no teste** (verificado: o teste do 404 passou a falhar com 500).
3. Se o projeto precisar de metadata de tipo (por exemplo `ValidationPipe` com DTO de classe, que lê o tipo do parâmetro), **pré-compile com `tsc` e remova o `build.esbuild`**, como a documentação do Serverless recomenda. Não misture as duas rotas.

Detalhes do `tsconfig`, do Vitest, do Biome e do bundle em `references/vitest-e-decorators.md`.

## Módulos por contexto

| Regra | Motivo |
| ----- | ------ |
| Um módulo Nest por contexto; ele só declara tokens e liga portas a adapters | O módulo é composição, não regra |
| `AppModule` só importa os módulos de contexto e registra o que é global (filtros) | Um ponto de composição |
| Exporte do módulo só o que outro contexto precisa | Fronteira de contexto |
| Contextos não importam o interior um do outro | Veja `skill-ddd` |
| Sem `forwardRef()`: dependência circular é sinal de fronteira errada | Redesenhe |
| Configuração lida uma vez e injetada como objeto tipado; segredo vem do Secrets Manager | `AGENTS.md` |

## Injeção das portas

Porta é `type` no núcleo. No módulo, o **token** (um `Symbol`) liga a porta ao adapter, e o caso de uso entra como **provider de fábrica**: o núcleo continua sem decorador.

```ts
// src/orders/tokens.ts
import type { Order } from '../core/get-order.js';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
export const GET_ORDER = Symbol('GET_ORDER');

export type GetOrder = (id: string) => Promise<Order>;
```

```ts
// src/orders/orders.module.ts
import { Module } from '@nestjs/common';

import { InMemoryOrderRepository } from '../adapters/in-memory-order-repository.js';
import { getOrder, type OrderRepository } from '../core/get-order.js';
import { OrdersController } from '../http/orders.controller.js';
import { GET_ORDER, type GetOrder, ORDER_REPOSITORY } from './tokens.js';

@Module({
  controllers: [OrdersController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: InMemoryOrderRepository },
    {
      provide: GET_ORDER,
      useFactory:
        (orders: OrderRepository): GetOrder =>
        (id) =>
          getOrder(orders, id),
      inject: [ORDER_REPOSITORY],
    },
  ],
})
export class OrdersModule {}
```

```ts
// src/http/orders.controller.ts
import { Controller, Get, Inject, Param } from '@nestjs/common';

import type { Order } from '../core/get-order.js';
import { GET_ORDER, type GetOrder } from '../orders/tokens.js';

@Controller('orders')
export class OrdersController {
  constructor(@Inject(GET_ORDER) private readonly getOrder: GetOrder) {}

  @Get(':id')
  find(@Param('id') id: string): Promise<Order> {
    return this.getOrder(id);
  }
}
```

O `Order`, o `getOrder` e a porta `OrderRepository` vêm de `src/core/get-order.ts` (ilustrativo, como em `skill-error-handling`). Controller fino: só traduz HTTP e chama o caso de uso. Evite `@Res()`, que desliga interceptors e a serialização. Guard chama service, não banco.

## Erro de domínio: filtro

O núcleo lança `DomainError` com `code`; um `@Catch(DomainError)` na borda do Nest traduz com o mapa de `code` para status (o mesmo de `skill-error-handling`) e responde pelo `HttpAdapterHost`, injetado **com `@Inject(HttpAdapterHost)`**. Registre-o no `AppModule` com `{ provide: APP_FILTER, useClass: DomainErrorFilter }`. Erro inesperado cai no filtro padrão do Nest, que responde 500 genérico e registra, sem vazar a mensagem (verificado). Código completo em `references/filtro-de-erro.md`.

O Nest 12 tem `ValidationPipe` (class-validator, que lê o metadata de tipo) e `StandardSchemaValidationPipe` (schema-first, com Zod, Valibot ou ArkType). Com a regra do esbuild acima, prefira o schema-first; confirme na PoC. O núcleo valida suas invariantes por conta própria.

## Entrypoints

**Container (`main-http`)**: porta por `PORT`, `/health`, log JSON no stdout e shutdown gracioso (contrato do ADR 0008). Um `HealthController` com `@Get()` em `health` devolve `{ status: 'ok' }`.

```ts
// src/main-http.ts
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule, {
  logger: new ConsoleLogger({ json: true }),
});
// WHY: sem isto o SIGTERM do orquestrador derruba o processo sem rodar os hooks
// de desligamento (conexões abertas, requisições em andamento).
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 8080);
```

**Lambda (`main-lambda`)**: o Nest com plataforma Express sobe uma vez por ambiente de execução, e o `configure` do `@codegenie/serverless-express` traduz o evento do HTTP API. Use `app.init()`, não `listen`.

```ts
// src/main-lambda.ts
import { configure } from '@codegenie/serverless-express';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Handler } from 'aws-lambda';

import { AppModule } from './app.module.js';

// WHY: guardar a Promise (não o resultado) evita subir o Nest duas vezes
// quando duas invocações chegam antes de o bootstrap terminar; se o bootstrap
// falhar, o cache é limpo para a próxima invocação tentar de novo.
let cached: Promise<Handler> | undefined;

const bootstrap = async (): Promise<Handler> => {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true }),
  });
  await app.init();
  return configure({ app: app.getHttpAdapter().getInstance() });
};

export const handler: Handler = async (event, context, callback) => {
  cached ??= bootstrap().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  const server = await cached;
  return server(event, context, callback);
};
```

No `serverless.yml`, `handler: src/main-lambda.handler`. O esbuild não resolve os imports opcionais do Nest (verificado direto no esbuild, não dentro do Serverless), então o bundle pede `external` (lista em `references/vitest-e-decorators.md`).

**Consumidor de fila**: sem HTTP, use `NestFactory.createApplicationContext(AppModule)` (a doc do Nest recomenda para função por endpoint), guarde-o em cache como acima, resolva o caso de uso com `app.get(TOKEN)` e devolva `batchItemFailures` (veja `skill-error-handling`). O worker de long-polling do container usa o mesmo caso de uso.

A escolha do modo por `AWS_LAMBDA_RUNTIME_API`, citada no ADR 0008, **não foi verificada** para Node em imagem de container: confirme na PoC como a imagem escolhe entre `main-http` e `main-lambda` (por exemplo, pelo `CMD`).

## Testes com Vitest

Vitest, nunca Jest (o Nest 12 já gera projetos ESM com Vitest). Teste o **núcleo** sem Nest; teste a **composição** com `Test.createTestingModule`, trocando a porta por um fake; teste a **ponte** chamando o `handler` com um evento mínimo do HTTP API, como o `lambda.spec.ts` do `example-ts`.

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(ORDER_REPOSITORY)
  .useValue({ findById: async () => null })
  .compile();
const app = moduleRef.createNestApplication();
await app.listen(0); // porta efêmera; chame com fetch(`${await app.getUrl()}/orders/1`)
```

Imports de `vitest` explícitos, como nos serviços (`import { describe, expect, it } from 'vitest'`). Config e exemplos completos em `references/vitest-e-decorators.md`.

## Anti-padrões

| Anti-padrão | Correção |
| ----------- | -------- |
| `@nestjs/*` dentro de `src/core` | Núcleo puro; decorador só em `http/`, módulos e adapters |
| Injeção por tipo sem `@Inject` | `@Inject(token)` em tudo; `emitDecoratorMetadata: false` |
| Regra de negócio no controller ou no guard | Mover para o núcleo |
| `@Res()` no controller | Retornar o valor |
| `statusCode` dentro do erro de domínio | `code` no núcleo; filtro traduz |
| Bootstrap do Nest a cada invocação da Lambda | Cache da `Promise` do handler, fora da função |
| `forwardRef()` para resolver ciclo | Redesenhar a fronteira |
| Jest, ou `ts-jest` | Vitest |

## Checklist

- [ ] Nada do Nest importado em `src/core`.
- [ ] Toda injeção com `@Inject(token)`; `emitDecoratorMetadata: false`.
- [ ] Um módulo por contexto; `AppModule` só compõe.
- [ ] Filtro de erro de domínio registrado; erro inesperado não vaza.
- [ ] `main-http` cumpre o contrato (`PORT`, `/health`, JSON, `SIGTERM`); `main-lambda` com bootstrap em cache.
- [ ] Biome com o override de decoradores (`references/vitest-e-decorators.md`).
- [ ] Testes do núcleo, da composição e da ponte, em Vitest.
- [ ] Marcado como roadmap onde ainda não existe.

## Veja também

- `references/vitest-e-decorators.md` (tsconfig, Vitest, Biome e esbuild) e `references/filtro-de-erro.md`.
- `docs/adr/0008-adapters-de-runtime.md` e `docs/adr/0004-serverless-e-terraform.md`.
- `docs/guides/servico-serverless.md` e `docs/architecture/overview.md` (o que é roadmap).
- Skills `skill-architecture-patterns`, `skill-error-handling` e `skill-ddd`.
