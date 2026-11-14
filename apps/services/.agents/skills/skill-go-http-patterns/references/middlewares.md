# Middlewares em Go (stdlib)

Complemento do [`SKILL.md`](../SKILL.md). Padrão a seguir: o `example-go` já tem `assignRequestID`, `logRequest` e `recoverPanic` (em `cmd/example-go/runtime.go` e `router.go`), aninhados à mão, sem o `chain` abaixo.

Forma `func(http.Handler) http.Handler`, compostos por um `chain` em que o **primeiro é o mais externo**:

```go
type middleware func(http.Handler) http.Handler

func chain(h http.Handler, mws ...middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				if rec == http.ErrAbortHandler {
					panic(rec) // sinal da stdlib para abortar a resposta
				}
				slog.ErrorContext(r.Context(), "handler_panic",
					"method", r.Method, "path", r.URL.Path,
					"error", rec, "stack", string(debug.Stack()))
				writeError(w, r, http.StatusInternalServerError, "internal", "Erro interno")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Unwrap deixa http.NewResponseController alcançar o writer original.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

func accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.InfoContext(r.Context(), "request_completed",
			"method", r.Method, "route", r.Pattern,
			"status", rec.status, "durationMs", time.Since(start).Milliseconds())
	})
}
```

- Ordem, a mesma dos templates: id de correlação por fora (`assignRequestID`, no `runtime.go` do `example-go`), depois log de acesso, e o `recoverer` por dentro, para o resumo `request_completed` registrar também o 500 de um panic. Ordem diferente muda o que é logado e capturado.
- `r.Pattern` no log de acesso funciona porque o `ServeMux` preenche o campo na mesma `*http.Request`; use-o em vez de `r.URL.Path`.
- Correlação: aceite `X-Request-Id` ou gere um e ponha no `context` e no log. Na Lambda, o id do API Gateway está em `core.GetAPIGatewayV2ContextFromContext(r.Context())` (pacote `.../aws-lambda-go-api-proxy/core`); mantenha esse acoplamento só no `cmd/`.
- Middleware não lê nem reescreve o corpo; o corpo é decodificado uma vez, no handler.
- CORS, domínio, WAF e cache são do edge (L5, Terraform), não do serviço.
