---
paths:
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/*_test.go"
  - "**/vitest.config.*"
  - "**/playwright.config.*"
---

# Convenções de teste

Vale para todo teste do repositório. O específico de cada stack está no escopo dela: Go na rule `services-go` e serviços TypeScript na `services-typescript` (ambas em `apps/services`), componentes React no `AGENTS.md` do backoffice e Playwright no `AGENTS.md` do `backoffice-e2e`.

## Stack

| Alvo                  | Ferramenta                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------- |
| TypeScript (unitário) | **Vitest**, o único runner: use `vi.fn`, `vi.spyOn` e `vi.stubEnv`, sem APIs de outro runner |
| Integração com AWS    | Contra o **Floci** (`http://localhost:4566`). Nunca outro emulador                           |

Rode pelo Nx: `pnpm nx test <projeto>` ou `pnpm nx affected -t test`. Cobertura só quando pedida (`VITEST_COVERAGE=1`).

## O que testar onde

| Categoria  | Alvo                                                        | Observação                                          |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Unitário   | Núcleo (`src/core`, `internal/core`), funções puras         | Sem runtime nem AWS: é a razão de o núcleo ser puro |
| Entrypoint | Tradução evento ou requisição para o caso de uso e de volta | Evento mínimo, asserção no status e no corpo        |

Mock apenas na **porta** (fronteira do núcleo), preferindo um fake simples. Não faça mock do que você está testando.

## Nomes e organização

- `describe` nomeia o sujeito (`'sayHello'`, `'entrypoint Lambda'`); `it` descreve o comportamento no presente, em PT-BR (`'traduz o evento do HTTP API em resposta JSON'`). Confira 2 ou 3 testes vizinhos antes de criar.
- Sem pasta `tests/` espelhada: o teste fica ao lado do código.
- Organize em Arrange, Act, Assert. Um comportamento por teste.

## Determinismo

- Teste não depende de relógio, rede, ordem de execução nem de estado de outro teste. Fixe o tempo e injete o que varia.
- Variável de ambiente em teste TypeScript: `vi.stubEnv`.
- Teste de integração com o Floci fica separado (arquivo dedicado) para não entrar no `affected` padrão.
- Teste instável se **investiga**: não marque `skip` nem aumente timeout para esconder condição de corrida.

## Regra dura

Além de não alterar teste só para fazê-lo passar (`AGENTS.md` da raiz): não apague teste que falha.
