# Erros em Go

Complemento de `SKILL.md`. Os princípios são os mesmos (núcleo diz o que aconteceu, entrypoint decide, nada interno na resposta, JSON no stdout); a mecânica muda porque erro é valor. Os trechos compilam e passam no `go vet`; o padrão é **a seguir**: os geradores `service-go` já trazem o `ErrInvalidInput` (tipo `sqs`), o `writeError` e o 500 padronizado, mas ainda não o mapa completo de erro para status.

## Núcleo: sentinelas e contexto

`internal/core` devolve `(T, error)`, acrescenta contexto com `%w` e expõe sentinelas para as decisões:

```go
package core

import "errors"

// Erros de domínio: o núcleo diz o que aconteceu; o entrypoint traduz.
var (
	ErrNotFound     = errors.New("not_found")
	ErrInvalidInput = errors.New("invalid_input")
	ErrRuleViolated = errors.New("rule_violated")
)
```

```go
return fmt.Errorf("pedido sem itens: %w", core.ErrRuleViolated)
```

- Quem decide compara com `errors.Is(err, core.ErrNotFound)`; nunca pela string da mensagem.
- Use um tipo próprio com `errors.As` só quando o erro carrega dados que o chamador usa.
- `(*T, error)` com `nil, nil` para "não existe" é válido em consulta (`FindByID`); o caso de uso converte em `ErrNotFound`.
- `panic` é para erro de programação, nunca para fluxo. `recover` que esconde bug é proibido.
- Não ignore erro (`data, _ := json.Marshal(...)`). O `go vet` e o `errcheck` ajudam, mas o `go vet` não roda no Nx hoje: rode à mão.

## Entrypoint HTTP: tradução

O mapa de erro para status fica em `cmd/<svc>`, ao lado do router. O detalhe interno vai para o log; o corpo do 500 é genérico.

```go
package main

import (
	"errors"
	"log/slog"
	"net/http"

	"example/svc/internal/core"
)

// statusFor traduz o erro de domínio; o que não é conhecido vira 500.
func statusFor(err error) (status int, code, message string) {
	switch {
	case errors.Is(err, core.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input", "Entrada inválida"
	case errors.Is(err, core.ErrNotFound):
		return http.StatusNotFound, "not_found", "Não encontrado"
	case errors.Is(err, core.ErrRuleViolated):
		return http.StatusUnprocessableEntity, "rule_violated", "Regra violada"
	default:
		return http.StatusInternalServerError, "internal", "Erro interno"
	}
}

func respondError(w http.ResponseWriter, r *http.Request, err error) {
	status, code, message := statusFor(err)
	if status == http.StatusInternalServerError {
		// WHY: o detalhe interno vai para o log, nunca para o cliente.
		slog.ErrorContext(r.Context(), "unhandled_error", "error", err)
	}
	writeError(w, r, status, code, message)
}
```

O `writeError` (e o `writeJSON` embaixo dele) já vem no `runtime.go` gerado: ele escreve `{"error":{"code","message","requestId"}}`, e o `requestId` sai do `context`. A mensagem do 4xx é fixa por `code`; o contexto acrescentado com `%w` vai só para o log. Se o cliente precisar do detalhe (por exemplo, o campo inválido), use um tipo de erro com mensagem própria para ele.

## Logs JSON com `slog`

O handler padrão do `slog` escreve **texto**. Para o contrato do ADR 0008 (JSON no stdout), o `runtime.go` gerado configura o handler uma vez, no `main`, com o nível de `LOG_LEVEL`, os campos fixos `time`, `level` e `message` e a lista de chaves seguras (`safeKeys`):

```go
func setupLogger() {
	slog.SetDefault(newLogger(os.Stdout, os.Getenv("LOG_LEVEL")))
}
```

Use sempre a variante com contexto (`slog.ErrorContext(ctx, ...)`): é ela que leva o `requestId` ao log, porque o `requestIDHandler` o lê do `context`. As chaves são estáveis (`"messageId"`, `"error"`) e **precisam estar em `safeKeys`**: o que não está sai como `[redacted]`. Nada de dado pessoal ou segredo.

## Fila: falha parcial

O gerador `service-go --type=sqs` traz o padrão (`cmd/<svc>/lambda.go` e `internal/core/messages.go`): o núcleo devolve `ErrInvalidInput` por mensagem, e o entrypoint decide o nível do log (WARN para a falha permanente, ERROR para a inesperada) e põe o id em `BatchItemFailures`.

```go
func handleSQS(ctx context.Context, event events.SQSEvent) (events.SQSEventResponse, error) {
	ctx = withLambdaRequestID(ctx)
	failures := []events.SQSBatchItemFailure{}
	for _, record := range event.Records {
		message := core.Message{ID: record.MessageId, Body: record.Body}
		if err := core.ProcessMessage(ctx, message); err != nil {
			// WHY: entrada inválida é falha esperada e não se resolve repetindo; a
			// mensagem volta para a fila e segue para a DLQ pelo maxReceiveCount.
			permanent := errors.Is(err, core.ErrInvalidInput)
			level := slog.LevelError
			if permanent {
				level = slog.LevelWarn
			}
			slog.Log(ctx, level, "message_failed",
				"messageId", record.MessageId, "receiveCount", receiveCount(record),
				"permanent", permanent, "error", err)
			failures = append(failures, events.SQSBatchItemFailure{ItemIdentifier: record.MessageId})
			continue
		}
		slog.DebugContext(ctx, "message_processed", "messageId", record.MessageId)
	}
	return events.SQSEventResponse{BatchItemFailures: failures}, nil
}
```

O `lambda.go` gerado acrescenta o resumo `batch_completed` (`total`, `failed`, `durationMs`, `status`), emitido num `defer`. O handler devolve `nil` como erro: um erro retornado reprocessa o lote inteiro. O consumidor de fila em container (long-polling) é roadmap e deve chamar o mesmo caso de uso.

## Timeout

`context.WithTimeout` propaga o cancelamento ao cliente HTTP, à consulta e às goroutines filhas. O prazo da chamada deve ser menor que o `timeout` da função.

```go
func fetch(ctx context.Context, url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("montar requisição: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("chamar %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("http %d em %s", resp.StatusCode, url)
	}
	return io.ReadAll(resp.Body)
}
```

## Anti-padrões em Go

| Anti-padrão | Correção |
| ----------- | -------- |
| `data, _ := ...` | Tratar o erro |
| `fmt.Errorf("%w", err)` sem contexto | Acrescentar o que se tentava fazer |
| `if err.Error() == "..."` | `errors.Is` ou `errors.As` |
| `panic` para erro de entrada | Devolver `error` |
| `recover()` que engole | Deixar o processo cair e registrar |
| `err.Error()` do SDK na resposta | Log com detalhe, resposta genérica |
