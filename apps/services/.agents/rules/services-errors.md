---
paths:
  - "**/*.ts"
  - "**/*.go"
  - "**/*.java"
---

# Erros nos serviços

Padrões completos e exemplos: skill `skill-error-handling`; em Go, veja também `skill-go` e a rule `services-go`. O que vale para todo o repositório (não vazar detalhe interno, sem `catch` vazio, logar uma vez) está na rule `error-handling` da raiz.

## Onde cada coisa acontece

1. **Núcleo** (`src/core`, `internal/core`) **lança ou devolve** erros de domínio tipados, com um `code` estável (`not_found`, `conflict`, `invalid_input`...). Não conhece HTTP, SQS nem status code.
2. **Entrypoint** traduz o erro para a fronteira em que está: status HTTP e corpo de erro; falha parcial de lote na fila; log e retentativa. Erro desconhecido vira 500 com mensagem genérica.

## Regras

- Fila: o handler de lote devolve só as mensagens que falharam (`batchItemFailures`); não lance erro para o lote inteiro e não engula a falha. Quem processa precisa ser idempotente.
- Chamada a serviço externo (inclusive AWS) tem **timeout** explícito.
- Erro de validação de entrada é **400** (com os campos inválidos); falta de permissão é **403**; autenticação ausente ou inválida é **401**. Não use 500 para erro do cliente.
- O formato do corpo de erro dos templates está no `AGENTS.md` de `apps/services` (`{"error":{"code","message","requestId"}}`). Ele não está fixado em ADR: siga-o e, se precisar de outro, registre a decisão.
