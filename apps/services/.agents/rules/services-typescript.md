---
paths:
  - "**/*.ts"
---

# TypeScript nos serviços

Complementa a rule `typescript` da raiz (imports `nodenext` e estilo). Referência viva: `example-ts`.

**Obrigatório:** concorrência e event-driven conforme a rule global `~/.claude/rules/reactive-event-driven.md` do mantenedor (princípios e seção TypeScript): não bloquear o event loop, streams com `pipeline` para fluxo de dados, concorrência limitada e nenhum global mutável entre invocações.

- No núcleo, `type` e arrow `const`.
- Sem `enum` em código novo de serviço: prefira união de literais.
- Nos testes, importe `describe`, `it` e `expect` de `vitest`. Exemplos: `example-ts/src/**/*.spec.ts`.
