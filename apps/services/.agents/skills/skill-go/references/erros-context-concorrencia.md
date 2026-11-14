# Erros, context e concorrência em Go

Complemento do [`SKILL.md`](../SKILL.md). Os exemplos seguem o estilo do `apps/services/example-go`.

## Erros

O núcleo (`internal/core`) **classifica** o erro; quem fala com o mundo (`cmd/<svc>`) decide o que fazer com ele: status HTTP no router, `batchItemFailures` no handler de fila. O núcleo não conhece HTTP nem SQS.

```go
// Sentinela: condição conhecida, comparada com errors.Is.
var ErrNotFound = errors.New("not found")

// Tipo: carrega dados, extraído com errors.As.
type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string {
	return "validation: " + e.Field + " " + e.Reason
}

func (s *Service) Find(ctx context.Context, id string) (Order, error) {
	order, err := s.repo.ByID(ctx, id)
	if err != nil {
		// %w preserva a cadeia; adicione o contexto que o chamador não tem.
		return Order{}, fmt.Errorf("find order %s: %w", id, err)
	}
	return order, nil
}
```

| Situação | Use |
| --- | --- |
| Condição que o chamador testa (`NotFound`, `Conflict`) | sentinela + `errors.Is` |
| Erro com campos (qual campo, qual limite) | tipo com `Error()` + `errors.As` |
| Vários erros independentes (validar todos os campos) | `errors.Join(errs...)` |
| Erro de biblioteca que o chamador não deve ver | embrulhe com `%w` na borda, ou com `%v` se não quiser expor a causa |
| Falha de programação (índice fora, invariante quebrada) | `panic`, nunca para fluxo normal |

Evite: comparar `err.Error()` com string, `fmt.Errorf("%w", err)` sem contexto (equivale a `return err`), `_ = f()` em erro que importa e `panic(err)` em código de requisição. Logue o erro **uma vez**, na borda; nas camadas internas, embrulhe e devolva.

Se um erro precisa de um código estável para a resposta (`not_found`, `validation_failed`), defina o tipo no núcleo com o código e implemente `Unwrap() error` para manter a cadeia. O mapeamento código para status HTTP está em skill-go-http-patterns.

## Context

```go
func (s *Service) Process(ctx context.Context, in Input) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel() // sempre, mesmo que o timeout não dispare

	return s.repo.Save(ctx, in)
}
```

- `ctx` é o **primeiro parâmetro** de toda função que faz I/O ou espera. Nunca guarde `Context` em struct.
- `context.Background()` só no `main` e em testes; `context.TODO()` não entra em código de produção.
- Na Lambda, o `ctx` recebido pelo handler tem o deadline da invocação. Derive os timeouts dele (`ctx.Deadline()`), deixando folga para responder, em vez de fixar um valor maior que o timeout da função.
- Em trabalho de limpeza que precisa terminar mesmo após o cancelamento (por exemplo, devolver a mensagem à fila), use `context.WithoutCancel(ctx)` com um novo `WithTimeout`.
- `context.WithValue` é só para dado de escopo de requisição (id de correlação), com chave de tipo próprio (`type ctxKey struct{}`). Dependências entram por construtor, não pelo context.

## Concorrência

- Toda goroutine tem **dono**, um `ctx` para cancelar e um ponto de término. Goroutine sem fim é vazamento.
- `sync.WaitGroup.Go(f)` (Go 1.25+) dispara e registra a goroutine; `f` não pode entrar em `panic`.
- Paralelismo que propaga o primeiro erro e cancela o resto: `errgroup` de `golang.org/x/sync` (dependência extra, adicione com `go get` no módulo do serviço), com `SetLimit(n)` para limitar a concorrência.
- Channel para coordenar e passar dono de dado; `sync.Mutex`, `RWMutex` ou `atomic` para estado pequeno. Só o remetente fecha o channel.
- Dado compartilhado entre invocações (cache em variável de pacote ou no `main`) precisa de proteção: a Lambda reutiliza o processo e, no container, as requisições são concorrentes. O `go test -race` do target `test` pega parte disso.
- No modelo padrão da Lambda, cada ambiente de execução atende **uma** invocação por vez; o servidor HTTP do container atende várias ao mesmo tempo. O mesmo núcleo precisa ser seguro nos dois casos.

## Defer

```go
rows, err := db.QueryContext(ctx, query, args...)
if err != nil {
	return nil, err
}
defer rows.Close() // registre logo após checar o erro
```

- `defer` roda em ordem inversa (último registrado, primeiro executado).
- Os **argumentos** do `defer` são avaliados na hora do `defer`; para capturar o valor final, use closure: `defer func() { log.Println(i) }()`.
- Em laço, `defer` acumula até a função terminar; extraia o corpo do laço para uma função.
- Em escrita (arquivo, buffer), o erro de `Close()` importa: trate-o em vez de ignorá-lo.
