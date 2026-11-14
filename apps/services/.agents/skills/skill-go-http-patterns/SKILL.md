---
name: skill-go-http-patterns
description: >-
  Padrões HTTP em Go com a stdlib para serviços em `apps/services/*`: `http.ServeMux` do Go 1.22+ (método e wildcard no padrão),
  handlers finos, tradução de erro do núcleo para status HTTP, middlewares, `/health` e o mesmo router servindo Lambda
  (`httpadapter.NewV2`) e container. Use ao editar `cmd/<svc>/router.go`, criar rota, middleware ou resposta de erro.
  NÃO usar para estrutura geral e convenções de Go (skill-go), SQS (skill-go-queue-patterns) nem testes (skill-go-testing).
---

# HTTP em Go (stdlib)

O router é um `http.Handler` da stdlib, sem framework. O mesmo router atende a **Lambda** (via `aws-lambda-go-api-proxy`) e o **container** (`http.Server`), como no `apps/services/example-go` ([ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md)). A estrutura do serviço, o `main.go` e o `serve` estão na skill-go.

> **Status.** O que existe hoje é a Lambda HTTP com o router `net/http` do `example-go`. O `example-go` já tem `writeJSON`, `writeError`, o health, uma rota e os middlewares `assignRequestID`, `logRequest` e `recoverPanic` (`runtime.go` e `router.go`); o `chain`, o mapa de erros do núcleo e a leitura de corpo abaixo são **padrão a seguir**. O destino em container é roadmap.

Frameworks web (chi, gin, echo, fiber) não são usados no repositório. Desde o Go 1.22 o `ServeMux` cobre método e parâmetro de caminho; trazer um framework exige registrar a decisão. Se um dia houver grupos de rota, chi é a opção mais próxima da stdlib (handlers continuam `http.Handler` e passam pelo `httpadapter` sem mudança).

## Rotas com `ServeMux`

Padrão: `[MÉTODO ]/caminho`, com `{nome}` para um segmento.

```go
func newRouter(svc *core.Service) http.Handler {
	mux := http.NewServeMux() // nunca o http.DefaultServeMux
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("GET /orders/{id}", handle(getOrder(svc)))
	mux.HandleFunc("POST /orders", handle(createOrder(svc)))
	return chain(mux, assignRequestID, accessLog, recoverer)
}
```

| Padrão | Casa com |
| --- | --- |
| `GET /orders/{id}` | um segmento; valor em `r.PathValue("id")` |
| `GET /files/{path...}` | o resto do caminho, com barras |
| `GET /{$}` | só `/` (sem `{$}`, `/` casa com tudo) |
| `/orders` (sem método) | qualquer método |

Comportamento do `ServeMux`: `GET` casa também `HEAD`; caminho existente com método errado devolve **405 com `Allow`** e caminho inexistente, **404**, sem código seu; o padrão que casou fica em `r.Pattern` (Go 1.23+) e serve de rótulo de log e métrica sem a cardinalidade do caminho real; dois padrões que conflitam fazem `panic` no registro, então o erro aparece no boot e no teste.

**Na Lambda, o API Gateway filtra antes do router.** Cada rota exposta precisa de um evento `httpApi` no `serverless.yml` (o gerador cria só `GET /<nome>`); rota que existe no router e não no `serverless.yml` devolve 404 no HTTP API e funciona no container. Em serviço com muitas rotas, avalie um evento greedy `ANY /{proxy+}` e deixe o roteamento ao `ServeMux`. Os limites da Lambda valem aqui: o HTTP API corta em 30 s (o timeout padrão do gerador é 29) e a invocação síncrona aceita até 6 MB de requisição e de resposta.

## Handler fino

O handler decodifica, chama o núcleo, escreve a resposta. Regra de negócio fica em `internal/core`. Um tipo de handler que **devolve erro** concentra a tradução em um lugar:

```go
type handlerFunc func(w http.ResponseWriter, r *http.Request) error

func handle(h handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := h(w, r); err != nil {
			respondError(w, r, err)
		}
	}
}

func getOrder(svc *core.Service) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		order, err := svc.Find(r.Context(), r.PathValue("id"))
		if err != nil {
			return err
		}
		writeJSON(w, http.StatusOK, order)
		return nil
	}
}

func createOrder(svc *core.Service) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		var in core.NewOrder
		if err := readJSON(w, r, &in); err != nil {
			return err
		}
		order, err := svc.Create(r.Context(), in)
		if err != nil {
			return err
		}
		writeJSON(w, http.StatusCreated, order)
		return nil
	}
}
```

Passe sempre `r.Context()` ao núcleo: ele cancela quando o cliente desconecta e, na Lambda, carrega o deadline. Goroutine disparada por um handler que sobrevive à resposta não pode usar `r.Context()`.

### Leitura do corpo

Limite o tamanho e recuse campo desconhecido; valide regra de negócio no núcleo, não no handler.

```go
const maxBodyBytes = 1 << 20 // 1 MiB; o SQS usa 256 KiB, a Lambda aceita até 6 MB

type badRequestError struct{ msg string }

func (e *badRequestError) Error() string { return e.msg }

func readJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return err // respondError traduz para 413
		}
		return &badRequestError{msg: "corpo JSON inválido"}
	}
	return nil
}
```

Parâmetro de query: `r.URL.Query().Get("limit")`, convertido e validado (`strconv.Atoi`, limites mínimo e máximo) antes de chegar ao núcleo.

## Erros do núcleo para HTTP

O núcleo devolve sentinela ou tipo (veja `references/erros-context-concorrencia.md` da skill-go); só o `cmd/` conhece o status. O corpo de erro tem `code` estável (para máquina) e `message` (para pessoa). Os templates do plugin já devolvem `{"error":{"code","message","requestId"}}` pelo `writeError(w, r, status, code, message)` do `runtime.go`; o mapa abaixo, que o usa, é um padrão a seguir, e o repositório ainda não fixa um contrato de API.

```go
func respondError(w http.ResponseWriter, r *http.Request, err error) {
	var (
		invalid  *core.ValidationError
		badReq   *badRequestError
		tooLarge *http.MaxBytesError
	)
	switch {
	case errors.As(err, &badReq):
		writeError(w, r, http.StatusBadRequest, "invalid_request", badReq.msg)
	case errors.As(err, &tooLarge):
		writeError(w, r, http.StatusRequestEntityTooLarge, "payload_too_large", "Corpo grande demais")
	case errors.As(err, &invalid):
		writeError(w, r, http.StatusUnprocessableEntity, "validation_failed", invalid.Error())
	case errors.Is(err, core.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "Recurso não encontrado")
	case errors.Is(err, core.ErrConflict):
		writeError(w, r, http.StatusConflict, "conflict", "Conflito com o estado atual")
	default:
		slog.ErrorContext(r.Context(), "unhandled_error", "error", err, "route", r.Pattern)
		writeError(w, r, http.StatusInternalServerError, "internal", "Erro interno")
	}
}
```

| Status | `code` | Quando |
| --- | --- | --- |
| 400 | `invalid_request` | corpo ou parâmetro malformado |
| 401, 403 | `unauthorized`, `forbidden` | sem identidade, sem permissão (ver nota abaixo) |
| 404, 409 | `not_found`, `conflict` | ausente, duplicado ou versão desatualizada |
| 413 | `payload_too_large` | corpo acima do limite |
| 422 | `validation_failed` | regra de negócio violada |
| 429 | `too_many_requests` | limite de taxa |
| 500 | `internal` | o inesperado: **nunca** devolva `err.Error()` ao cliente; logue o detalhe |

Autenticação e autorização não têm decisão registrada no repositório (Cognito é de L1 no Terraform, [ADR 0009](../../../../../docs/adr/0009-camadas-e-ordem-de-implantacao.md)). Não improvise validação de JWT num middleware sem decisão; quando houver, leia as claims do `context` por chave de tipo próprio. Token nunca vai em query string.

## Middlewares

Forma `func(http.Handler) http.Handler`, compostos por um `chain` em que o **primeiro é o mais externo**. Código de `chain`, `recoverer` e `accessLog` em [`references/middlewares.md`](references/middlewares.md).

- Ordem, a mesma dos templates (`assignRequestID(logRequest(recoverPanic(mux)))`): id de correlação por fora, para todo log ter o `requestId`; depois o log de acesso; e o `recoverer` por dentro (repassa `http.ErrAbortHandler`). Assim o resumo `request_completed` registra também o 500 de um panic; um panic nos próprios middlewares externos fica com o recover padrão do `net/http`.
- O log de acesso usa `r.Pattern` em vez de `r.URL.Path`: o `ServeMux` preenche o campo na mesma `*http.Request`, e o padrão evita cardinalidade alta.
- O wrapper de `ResponseWriter` implementa `Unwrap() http.ResponseWriter`, para `http.NewResponseController` alcançar o writer original.
- Correlação: aceite `X-Request-Id` ou gere um e ponha no `context` e no log. Na Lambda, o id do API Gateway está em `core.GetAPIGatewayV2ContextFromContext(r.Context())` (pacote `.../aws-lambda-go-api-proxy/core`); mantenha esse acoplamento só no `cmd/`.
- Middleware não lê nem reescreve o corpo; o corpo é decodificado uma vez, no handler.
- CORS, domínio, WAF e cache são do edge (L5, Terraform), não do serviço.

## Health

```go
func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

- O contrato é `GET /health` ([ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md)). O `example-go` e os templates do `service-go` ainda expõem `/healthz` e respondem 204; alinhe ao contrato ao mexer no router.
- Devolva **200**: o health check do ALB aceita só 200 por padrão (o intervalo 200 a 499 é configurável), então um 204 reprovaria o alvo sem configuração extra.
- É liveness: não consulte banco nem fila aqui. Uma dependência fora do ar derrubaria todos os alvos ao mesmo tempo.
- Na Lambda o health só serve para teste local; o `serverless.yml` não precisa de evento para ele.

## Armadilhas

| Armadilha | Prefira |
| --- | --- |
| `http.ListenAndServe` ou `Server` sem `ReadHeaderTimeout` | `Server` com `ReadHeaderTimeout` (o `serve` do `example-go` já faz) |
| Lógica de negócio no handler | Caso de uso em `internal/core` |
| Comparar status ou mensagem de erro por string | `errors.Is` e `errors.As` na borda |
| Escrever header depois do corpo | `Header().Set` antes de `WriteHeader` e do primeiro `Write` |
| Ignorar o erro do `Encode` | Logar (como o `writeJSON` do `example-go`); o cliente já recebeu o status |
| Estado em variável de pacote | Injeção por construtor; o container atende requisições em paralelo |
| Rota nova só no router | Evento `httpApi` correspondente no `serverless.yml` |

## Checklist

- [ ] `http.NewServeMux()` com método no padrão; 404 e 405 vêm da stdlib.
- [ ] Handler fino devolvendo `error`; tradução em um só `respondError`; 500 sem vazar detalhe.
- [ ] Corpo com `MaxBytesReader` e `DisallowUnknownFields`; `r.Context()` propagado.
- [ ] Ordem id de correlação, log de acesso e `recoverer` (este por dentro, para o resumo ver o 500); log por `r.Pattern`.
- [ ] `GET /health` com 200, sem dependências externas.
- [ ] Toda rota exposta na Lambda tem evento `httpApi` no `serverless.yml`.

Veja também: skill-go, skill-go-testing (testes com `httptest` e pelo `httpadapter`), [`docs/adr/0008-adapters-de-runtime.md`](../../../../../docs/adr/0008-adapters-de-runtime.md), [`docs/guides/servico-serverless.md`](../../../../../docs/guides/servico-serverless.md) e `apps/services/example-go/cmd/example-go`.
