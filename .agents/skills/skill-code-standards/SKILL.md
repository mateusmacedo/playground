---
name: skill-code-standards
description: >-
  Como aplicar na prática os padrões de código do playground: onde o import leva sufixo `.js` e onde não, `type` x `interface`, testes Vitest ao lado do código, tags do Nx, estrutura de pastas de `apps/services` (TS e Go) e de `apps/backoffice/src`, e o que o Biome faz. Use ao criar ou editar código e precisar do estilo certo do projeto em que está. NÃO repete o AGENTS.md (leia-o primeiro) nem trata de princípios de código limpo (use skill-clean-code).
---

# Padrões de código na prática

O `AGENTS.md` é a fonte de verdade das regras **gerais** (TypeScript estrito, Biome, comentário do porquê, tags do Nx, comandos de validação). Esta skill não as repete: mostra **como cada projeto as aplica**, e onde os estilos divergem de propósito ou por história.

## Quando usar

- Vai criar ou editar um arquivo e precisa saber o estilo de import, de tipo, de teste e de pasta daquele projeto.
- Tem dúvida entre dois estilos que o repositório usa.

Regra de ouro quando houver divergência: **siga o arquivo e o projeto vizinhos**. Não refatore o estilo alheio de passagem.

## Estilo por projeto

| Tema | Serviços TS (`apps/services/*`) e `tools/serverless` | Backoffice (`apps/backoffice`) | Serviços Go |
| ---- | ------------------------------------------------------- | ------------------------------ | ----------- |
| Resolução de módulo | `nodenext`: import relativo **com** `.js` (`'./hello.js'`) | `bundler`: import relativo **sem** sufixo; alias `@/` para `src` | caminho de módulo do `go.mod` |
| Declaração | `type` e arrow `const` nos serviços (`sayHello`); `function` em `tools/serverless` | `interface` para contratos e `function` para componentes e utilitários | funções e `struct` |
| Import de tipo | `import type` (`verbatimModuleSyntax: true` nos `tsconfig.app.json`) | `import type` ou `type` inline | - |
| Teste | `*.spec.ts` ao lado; **importa** `describe`, `it` e `expect` de `vitest` | `*.spec.ts` ao lado; globals do Vitest, sem import | `_test.go` ao lado |
| Ambiente de teste | `node` | `jsdom` | `go test -race -cover ./...` |

Exemplos reais:

```ts
// apps/services/example-ts/src/entrypoints/lambda.ts (nodenext: sufixo .js)
import { sayHello } from '../core/hello.js';
```

```ts
// apps/backoffice/src/layout/app-breadcrumb.tsx (bundler: sem sufixo)
import { breadcrumbs } from './breadcrumbs';
```

O gerador `service-ts` já traz o estilo de serviço. Não remova o `.js` de um serviço nem o acrescente no painel: o resolvedor de cada um é diferente.

## Decisões que o AGENTS.md não fixa

- **`type` ou `interface`**: não há regra. Em núcleo de serviço use `type`; no painel os contratos públicos usam `interface` (`Session`, `Crumb`). Não misture no mesmo arquivo sem motivo.
- **`enum`**: não é proibido (o painel tem `enum AppStage`), mas código novo de serviço prefere **união de literais**, que não gera código em runtime e é o que o resto do repositório usa (`ServerlessStage`, `ServiceType`, `SessionStatus`).
- **Props de componente**: tipadas inline com `Readonly<{ ... }>`, como em `shared/ui/states.tsx`.
- **Configuração e ambiente**: o painel lê a configuração pública só por `src/core/config/app-config.ts`; um serviço lê o ambiente em **um** ponto do entrypoint (veja `skill-architecture-patterns`). **Nenhum segredo em `NEXT_PUBLIC_*`.**
- **Idioma**: identificadores e nomes de arquivo em inglês. Comentário, descrição de teste, JSDoc e texto de interface em PT-BR, acessível (`aria-*`, papéis corretos).
- **Next.js 16**: leia o guia certo em `node_modules/next/dist/docs/` antes de código novo (`apps/backoffice/AGENTS.md`).

## Onde cada coisa fica

```text
apps/services/<svc>/            serviço TypeScript
  serverless.yml                custom.nxServerless é obrigatório
  package.json                  "type": "module"
  tsconfig.json, tsconfig.app.json, tsconfig.spec.json
  vitest.config.mts
  src/core/                     núcleo puro, com *.spec.ts ao lado
  src/entrypoints/lambda.ts     traduz evento e chama o núcleo

apps/services/<svc>/            serviço Go
  go.mod, serverless.yml
  internal/core/                núcleo puro, com *_test.go ao lado
  cmd/<svc>/                    main.go, router.go, runtime.go

apps/backoffice/src/
  app/                          rotas (grupo `(painel)`)
  layout/                       shell, nav.ts, routes.ts
  shared/ui, shared/hooks       componentes e hooks reutilizáveis
  core/                         config e sessão
```

Serviço novo nasce do generator (`pnpm nx g ./tools/serverless:service-ts <nome> --type=http|sqs|scheduled`, com `--dry-run` antes). Página nova no painel mexe em três lugares: `src/app/(painel)/<rota>`, `src/layout/nav.ts` e `src/layout/routes.ts`. Lib compartilhada nasce de gerador do Nx, em `packages/`, ligada por dependência de workspace do pnpm.

## Tags do Nx

Use as tags existentes antes de inventar outras:

| Projeto | Tags |
| ------- | ---- |
| Serviço TypeScript | `type:app`, `stack:ts`, `platform:serverless` |
| Serviço Go | `type:app`, `stack:go`, `platform:serverless` |
| `backoffice` | `scope:backoffice`, `type:app` |
| `infra-local` | `scope:infra`, `type:tool` |
| `nx-serverless` | `type:tool`, `scope:shared` |

O generator aceita `--domain` (gera `scope:<domain>`) e `--tags` para as extras.

## Biome e ESLint na prática

- `pnpm format` formata e organiza os imports; `pnpm lint` roda o Biome e as fronteiras do Nx. O `biome.json` ignora `.agents`, `.claude` e pastas geradas.
- `noImportCycles` é erro: um ciclo de import quebra o lint.
- Decoradores (Nest, roadmap) pedem configuração própria no Biome: veja `skill-nestjs-patterns`.
- Não existe Prettier nem `nx format`, e o ESLint só cuida de `@nx/enforce-module-boundaries` (ADR 0007).

## Testes

- Descreva o **comportamento**, em PT-BR: `it('traduz o evento do HTTP API em resposta JSON', ...)`.
- Núcleo: teste direto, sem mock de runtime (`hello.spec.ts`). Entrypoint: monte o evento mínimo e confira a tradução (`{ rawPath: '/example-ts' } as APIGatewayProxyEventV2`, como o `lambda.spec.ts`).
- **Vitest**, nunca Jest: `vi.fn`, `vi.spyOn`. Cobertura só quando pedida (`VITEST_COVERAGE=1` ou `--coverage`; o `pnpm check:full` já a liga).
- Rode pelo Nx: `pnpm nx test <projeto>`, nunca o `vitest` direto.

## Go

- `gofmt` é imposto pela toolchain. No Go, o Nx roda `build`, `test` (`go test -race -cover ./...`) e `lint` (`gofmt -l` pelo `tools/go-fmt-check.sh` e `go vet ./...`); o `pre-commit` formata os `.go` do commit.
- `internal/core` não importa `net/http` nem `aws-lambda-go`; `cmd/<svc>` é fino. Veja `skill-architecture-patterns`.
- Nome de teste descreve o comportamento (`TestSayHelloDevolveMensagemECaminho`).

## Checklist

- [ ] Estilo do import (`.js` ou não) igual ao do projeto.
- [ ] `import type` para tipos; sem `any`.
- [ ] Teste `*.spec.ts` (ou `_test.go`) ao lado do código, em Vitest.
- [ ] Tags existentes; dependência nova no catálogo (`catalog:`).
- [ ] Nada de segredo em `NEXT_PUBLIC_*`; ambiente lido em um ponto só.
- [ ] `pnpm nx affected -t lint typecheck test build` e `pnpm format:check` verdes (`AGENTS.md`).

## Veja também

- `AGENTS.md` (seções "Convenções do monorepo" e "Comandos de validação").
- `docs/guides/servico-serverless.md`, `docs/guides/backoffice-nova-pagina.md` e `docs/guides/nx-tarefas.md`.
- `docs/adr/0007-lint-e-formatacao-biome-eslint-minimo.md`.
- Skills `skill-clean-code` e `skill-architecture-patterns`.
