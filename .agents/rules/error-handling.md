---
paths:
  - "apps/services/**"
  - "apps/backoffice/src/**"
  - "tools/**"
---

# Tratamento de erros

Vale para todo o código. Onde o erro nasce e como é traduzido no serviço (núcleo, entrypoint, fila, status HTTP) está na rule `services-errors` de `apps/services`; o erro na tela do painel, no `AGENTS.md` do backoffice. Padrões completos: skill `skill-error-handling`.

- **OBRIGATÓRIO**: nunca devolva ao cliente stack trace, mensagem de SDK, SQL ou nome de recurso interno. Detalhe fica no log; a resposta leva `code` e mensagem amigável.
- Sem `catch {}` vazio. Se descartar o erro é deliberado, diga o motivo em um comentário `WHY:`.
- **Logue uma vez, onde o erro é tratado**, em JSON no stdout, com contexto (identificador da requisição, operação) e sem dado sensível. Não relogue em cada camada. **Obrigatório:** os 7 princípios de log e o checklist de review da seção 5 da rule global `~/.claude/rules/senior-engineering.md` do mantenedor.
