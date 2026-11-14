---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---

# Go nos serviços

Skills: `skill-go` (base), `skill-go-http-patterns`, `skill-go-db-patterns`, `skill-go-queue-patterns` e `skill-go-testing`. Referência viva: `example-go`.

**Obrigatório:** concorrência e event-driven conforme a rule global `~/.claude/rules/reactive-event-driven.md` do mantenedor (princípios e seção Go): `context` com deadline, concorrência limitada como backpressure, pipelines por canais e goroutine com dono e fim.

## Formatação e estilo

- **O Go é formatado pelo `gofmt`**, e não pelo Biome: o `pre-commit` roda `gofmt -w` nos `*.go` do commit e o job `format` do CI roda `gofmt -l` e falha se listar algo.
- Arquivos em `snake_case`, exportados em `PascalCase`, acrônimos inteiros (`UserID`). Receptor de 1 a 2 letras.
- `context.Context` é o primeiro parâmetro de toda chamada que faz I/O.
- A unidade é o **pacote**; vários arquivos por pacote são normais. `internal/` é a garantia da toolchain de que só o módulo importa. Nada de pacote `util` ou `common`: nomeie pelo domínio.

## Erros

- Erro é valor: `(T, error)`, `fmt.Errorf("contexto: %w", err)`, `errors.Is` e `errors.As`. `panic` só para erro de programação.
- Embrulhe com contexto a cada camada (`%w`) e não use `_ = err` sem comentário. `recover` só na fronteira (handler HTTP, worker de fila), para virar log e resposta 500.

## Testes

- `testing` da stdlib, `httptest` e testes de tabela. No entrypoint, o router sob `httptest` nos dois modos (Lambda e HTTP). Exemplos: `example-go/**/*_test.go`.
- `TestSujeitoCenario` em PT-BR, como `TestRouterRespondeNoModoLambda`, e `t.Run` para variações; `t.Helper()` nos auxiliares, `t.Cleanup` no teardown, fixtures em `testdata/`.
- Variável de ambiente com `t.Setenv` (não combina com `t.Parallel()`).
- Teste de integração com o Floci tem sufixo `_integration_test.go` com tag de build, para não entrar no `affected` padrão.
- Condição de corrida: `go test -race ./...`.

## Performance

- Pré-aloque slice e mapa quando o tamanho é conhecido; `defer rows.Close()` em consulta; `Ticker.Stop()`; `time.NewTimer` com `Reset` em vez de `time.After` em laço longo.

## Tamanho

| Tipo         | Referência                     | Ao ultrapassar                                                      |
| ------------ | ------------------------------ | ------------------------------------------------------------------- |
| Arquivo `.go` | ~400 linhas                   | Dividir por responsabilidade dentro do mesmo pacote                 |
| Função Go    | ~80 linhas ou complexidade ~15 | Extrair funções; o tratamento de erro explícito infla, e é esperado |

Pacote grande sugere falta de fronteira de domínio: quebre por subpacote.
