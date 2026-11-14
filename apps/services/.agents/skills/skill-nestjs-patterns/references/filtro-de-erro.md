# Filtro de erro de domínio e health

Complemento de `SKILL.md`. **Status: padrão a seguir**; Nest não existe no repositório. Os trechos compilam em `strict` e foram exercitados nos testes do projeto de verificação (Nest 12.5.0, Vitest 5.0.5, TypeScript 6.0.3). O `DomainError` e o mapa de `code` para status são os de `skill-error-handling`.

## Filtro

O filtro responde pelo `HttpAdapterHost` em vez de usar os tipos do Express, o que mantém o código independente da plataforma HTTP. A injeção é **explícita** (`@Inject(HttpAdapterHost)`): com a injeção por tipo, o bundle do esbuild perde o metadata e o filtro recebe `undefined` (todo erro de domínio vira 500).

```ts
// src/http/domain-error.filter.ts
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Inject,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { DomainError, type DomainErrorCode } from '../core/errors.js';

const statusByCode = {
  invalid_input: 400,
  not_found: 404,
  conflict: 409,
  rule_violated: 422,
} as const satisfies Record<DomainErrorCode, number>;

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(error: DomainError, host: ArgumentsHost): void {
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { error: { code: error.code, message: error.message } },
      statusByCode[error.code],
    );
  }
}
```

## Registro e composição

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { DomainErrorFilter } from './http/domain-error.filter.js';
import { HealthController } from './http/health.controller.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [OrdersModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
```

O `AppModule` só compõe: importa os módulos de contexto e registra o que é global.

## Health

O contrato de container do ADR 0008 pede health em `/health`:

```ts
// src/http/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

Este health só diz que o processo está de pé, sem consultar dependência externa. Checar dependência no health (readiness) é outra decisão, com efeito no ALB e no orquestrador: registre-a antes de adotar.

## Comportamento verificado

| Cenário | Resultado |
| ------- | --------- |
| `GET /orders/1` (existe) | 200 com o pedido |
| `GET /orders/99` (`DomainError` `not_found`) | 404 com `{ error: { code, message } }` |
| Porta lança `Error` inesperado | 500 genérico do Nest; a mensagem do erro não aparece na resposta |
| `GET /health` na Lambda (pela ponte) e no container | 200 `{ "status": "ok" }` |
