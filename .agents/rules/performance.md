---
paths:
  - "apps/services/**"
  - "apps/backoffice/**"
  - "tools/**"
---

# Performance

Meça antes de otimizar (`go test -bench -benchmem`, `pprof`, métrica do Floci ou da AWS). Otimização sem número é opinião. Desempenho **da esteira** (paralelismo do Nx, cache, e2e só se afetado) está em [`docs/guides/desempenho-e-recursos.md`](../../docs/guides/desempenho-e-recursos.md).

O específico de cada stack fica no escopo dela: Lambda e container no `AGENTS.md` de `apps/services`, Go na rule `services-go` e o painel no `AGENTS.md` do backoffice.

## Dados e chamadas externas

- Selecione só o que usa, pagine coleções, evite N+1 e use índice para filtro e ordenação frequentes.
- Chamadas independentes em paralelo (`Promise.all`, `errgroup`) com limite de concorrência; evite `await` sequencial desnecessário e goroutine sem `context`.
- Retentativa com backoff e jitter, só para erro transitório, com limite. Cache com TTL explícito e invalidação na escrita; chave com namespace (`user:{id}:profile`).
