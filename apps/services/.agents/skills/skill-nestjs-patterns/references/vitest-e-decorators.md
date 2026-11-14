# Vitest, decoradores, Biome e esbuild no Nest

Complemento de `SKILL.md`. **Status: padrão a seguir**; Nest não existe no repositório. O que está marcado "verificado" foi testado em um projeto **fora do repositório** com Nest 12.5.0, `@codegenie/serverless-express` 5.0.0, Vitest 5.0.5, Vite 8.3.8, TypeScript 6.0.3, Biome 2.6.7, esbuild 0.28.2 e Node 24. O que não foi testado dentro do repositório ou dentro do Serverless fica explícito.

## `tsconfig`

Nos `tsconfig.app.json` e `tsconfig.spec.json` do serviço Nest, junto do que o gerador `service-ts` já traz (`verbatimModuleSyntax`, `types`):

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  }
}
```

- `emitDecoratorMetadata` fica **desligado** pelo motivo do `SKILL.md`: o esbuild (bundle do Serverless v4) omite o metadata, e o teste precisa se comportar como o bundle. Com ele desligado, toda injeção é `@Inject(token)`.
- Com `strict`, campo de DTO de classe sem inicializador dá erro de propriedade não inicializada. O `tsconfig` que o Nest gera desliga `strictPropertyInitialization`; prefira não usar DTO de classe (validação schema-first) a afrouxar o `strict` do repositório.
- Com `isolatedModules` e `verbatimModuleSyntax`, um tipo importado em assinatura decorada precisa de `import type`; classe usada como valor (token ou injeção) usa import normal.

## Vitest

O serviço segue o `vitest.config.mts` do `example-ts` (`environment: 'node'`, `include: ['src/**/*.{test,spec}.ts']`). No Vite 8 o transformador (Oxc) já lê `experimentalDecorators` e `emitDecoratorMetadata` do `tsconfig`: **nenhum plugin foi necessário** (verificado, com os testes do módulo e da ponte Lambda passando).

A receita oficial do Nest para Vitest usa `unplugin-swc`. Só adote se aparecer um caso que o Oxc não cubra; o resultado nos testes foi igual nos dois (verificado com `unplugin-swc` 2.0.0):

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
```

Dependências do plugin: `unplugin-swc` e `@swc/core` (o catálogo já tem `@swc/core`). Não foi verificado como o `allowBuilds` do pnpm (`@swc/core: false`) se comporta no repositório.

### Teste da composição

Troque a porta por um fake e fale com o app por HTTP real, sem `supertest`:

```ts
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from '../app.module.js';
import type { OrderRepository } from '../core/get-order.js';
import { ORDER_REPOSITORY } from './tokens.js';

let app: INestApplication | undefined;

const start = async (repository?: OrderRepository): Promise<string> => {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (repository) {
    builder.overrideProvider(ORDER_REPOSITORY).useValue(repository);
  }
  const moduleRef = await builder.compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  return await app.getUrl();
};

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /orders/:id', () => {
  it('traduz erro de domínio em 404 pelo filtro', async () => {
    const url = await start();
    const response = await fetch(`${url}/orders/99`);
    expect(response.status).toBe(404);
  });

  it('não vaza erro inesperado', async () => {
    const url = await start({
      findById: async () => {
        throw new Error('senha=123 vazou');
      },
    });
    const response = await fetch(`${url}/orders/1`);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('senha');
  });
});
```

O Nest registra o erro inesperado no log (stack incluída) durante esse teste: é esperado.

### Teste da ponte Lambda

Chame o `handler` com um evento mínimo do HTTP API, como o `lambda.spec.ts` do `example-ts`. O bootstrap é cacheado, então o app é compartilhado entre os testes do arquivo.

```ts
const eventFor = (path: string): APIGatewayProxyEventV2 =>
  ({
    version: '2.0',
    routeKey: `GET ${path}`,
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'api.local' },
    requestContext: {
      http: {
        method: 'GET',
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req-1',
    },
    isBase64Encoded: false,
  }) as unknown as APIGatewayProxyEventV2;

const result = (await handler(
  eventFor('/health'),
  {} as Context,
  () => undefined,
)) as { statusCode: number; body: string };
expect(result.statusCode).toBe(200);
```

## Biome

O Biome precisa de uma opção para **parsear decorador de parâmetro** (`@Inject(...)`, `@Param(...)`); sem ela dá erro de `parse`. Em um `override` para o serviço Nest no `biome.json` da raiz (verificado; o arquivo hoje não tem `overrides`):

```json
{
  "overrides": [
    {
      "includes": ["apps/services/<nome>/src/**"],
      "javascript": { "parser": { "unsafeParameterDecoratorsEnabled": true } }
    }
  ]
}
```

Com `@Inject` explícito e metadata desligado, a regra `useImportType` pode ficar ligada: o que ela troca por `import type` é de fato só tipo. Se um dia o projeto adotar metadata de tipo (rota do `tsc` pré-compilado), **desligue** `style.useImportType` nesse `override`: o Biome não sabe que o decorador usa o import como valor, e o autofix quebraria a injeção (a documentação da regra recomenda desligá-la com decoradores experimentais).

## Bundle do Serverless (esbuild)

O Serverless Framework v4 empacota TypeScript com esbuild. Três fatos:

1. **Metadata de tipo**: omitido (documentação do Serverless; observado). Quem depende dele deve pré-compilar com `tsc` e remover `build.esbuild`. O plugin `tools/serverless` não tem target `build` para TypeScript hoje, então essa rota exigiria acrescentá-lo (não verificado).
2. **Imports opcionais do Nest**: o `NestFactory` e o `ValidationPipe` fazem `import()` lazy de pacotes opcionais, e o esbuild falha ao resolvê-los. Marque como `external` (lista verificada direto no esbuild, com o app deste padrão): `class-validator`, `class-transformer`, `@nestjs/microservices` e `@nestjs/websockets`. No `serverless.yml`, via `build.esbuild.external`; **não testado dentro do Serverless**.
3. **ESM**: em `format: esm`, o bundle falha com "Dynamic require is not supported" sem um `banner` que crie o `require` (`import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`). Com o banner o handler respondeu 200, 200 e 404 nos três caminhos testados. A alternativa `format: cjs` também gerou o bundle (não executado). Bundle de 2,8 MB sem minificar.

```yaml
build:
  esbuild:
    external:
      - class-validator
      - class-transformer
      - '@nestjs/microservices'
      - '@nestjs/websockets'
```

Como smoke do bundle real, rode o handler empacotado com um evento mínimo (como o script usado nesta verificação) ou o target `invoke-local` do plugin, **depois de confirmar** que ele usa o bundle do esbuild.

## O que não foi verificado

- Nada disto rodou dentro do monorepo nem dentro do `serverless package`, só em projeto isolado.
- Escolha do modo por `AWS_LAMBDA_RUNTIME_API` em imagem Node de container (ADR 0008).
- Se o plugin local `tools/serverless` aceita um serviço Nest sem ajustes; um gerador do Nx para Nest (`@nx/nest`); `StandardSchemaValidationPipe` na prática.
