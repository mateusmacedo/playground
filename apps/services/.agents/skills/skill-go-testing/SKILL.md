---
name: skill-go-testing
description: >-
  Testes de serviços Go em `apps/services/*` com `go test`: tabelas e subtests, `httptest`, o mesmo teste no router e via
  `httpadapter` (Lambda), eventos `events.SQSEvent`, fakes das portas de `internal/core`, relógio com `synctest`, fuzz e
  benchmark curtos, cobertura e execução pelo Nx (`pnpm nx test <svc>`). Use ao escrever ou revisar arquivos `*_test.go`.
  NÃO usar para Vitest (serviços TypeScript) nem para Playwright (`apps/backoffice-e2e`).
---

# Testes em Go

Só a biblioteca `testing` da stdlib: o `go.mod` dos serviços não traz testify nem gomock, e o repositório não os usa. Dependência nova de teste precisa de justificativa. Os testes de referência são `internal/core/hello_test.go`, `cmd/example-go/router_test.go` e `cmd/example-go/runtime_test.go`, e os gerados pelo `service-go` (`messages_test.go`, `adapters_test.go`).

## Execução pelo Nx

O target `test` é inferido pelo plugin `tools/serverless` e roda `go test -race -cover ./...` na pasta do serviço, com cache (entradas: `*.go`, `go.mod`, `go.sum` e a versão do Go). Não existem targets de fuzz, benchmark nem integração: esses são comandos diretos, abaixo.

```bash
pnpm nx test example-go                      # o gate: com -race e -cover
pnpm nx test example-go --skip-nx-cache      # força rodar de novo
pnpm nx affected -t test                     # o que o pre-push e o CI usam
pnpm nx show project example-go --json       # confira os targets antes de supor outros
```

Para iterar num teste, rode direto na pasta do serviço (atalho local, não substitui o target):

```bash
cd apps/services/example-go
go test -run TestRouter ./cmd/...            # filtra por nome
go test -run 'TestX/subnome' -v ./...        # um subteste
go test -count=1 ./...                       # ignora o cache do Go
```

`-race` exige cgo: sem `CGO_ENABLED=1` e um compilador C na máquina, o target falha com `-race requires cgo`. Nunca altere um teste só para fazê-lo passar; corrija o código de produção.

## Estrutura

- `*_test.go` ao lado do código, no **mesmo pacote** (`package core`, `package main`), como os testes atuais: alcançam funções internas como `newRouter` e `listenAddress`. Use pacote `core_test` quando quiser testar só a API pública.
- Nome `Test<Unidade><Comportamento>`, descrevendo o comportamento; siga o idioma do arquivo (os atuais descrevem em PT-BR).
- `t.Fatalf` quando o resto do teste perde o sentido; `t.Errorf` para checagens independentes. Mensagem no formato "esperado X, recebido Y".
- Comparação: `==` em struct comparável (como `HelloResponse`), `slices.Equal`, `maps.Equal` ou `reflect.DeepEqual`.
- `t.Helper()` em helper, `t.Cleanup` para limpeza, `t.TempDir()` para arquivo, `t.Context()` (Go 1.24+) para um `ctx` cancelado ao fim do teste.
- Variável de ambiente: `t.Setenv` (restaura sozinho). **Não combina com `t.Parallel()`**: o teste entra em `panic`.

## Núcleo: tabela e subtests

O núcleo é puro, então os testes são rápidos e sem mock. Caso por linha, `t.Run` por caso:

```go
func TestSayHello(t *testing.T) {
	cases := []struct {
		name string
		path string
		want HelloResponse
	}{
		{"raiz", "/", HelloResponse{Message: "Olá de example-go", Path: "/"}},
		{"caminho do serviço", "/example-go", HelloResponse{Message: "Olá de example-go", Path: "/example-go"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := SayHello(tc.path); got != tc.want {
				t.Fatalf("esperado %+v, recebido %+v", tc.want, got)
			}
		})
	}
}
```

Desde o Go 1.22 a variável do laço é por iteração: não precisa de `tc := tc` antes do `t.Parallel()`. Inclua os casos de erro, não só o caminho feliz.

## Fakes das portas

A porta é uma interface pequena do núcleo (skill-go): o teste escreve um **fake manual**, sem gerador de mock. Guarde estado em memória e deixe um campo para injetar falha.

```go
type fakeStore struct {
	orders  map[string]Order
	saveErr error
}

func (f *fakeStore) ByID(_ context.Context, id string) (Order, error) {
	o, ok := f.orders[id]
	if !ok {
		return Order{}, ErrNotFound
	}
	return o, nil
}

func (f *fakeStore) Save(_ context.Context, o Order) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.orders[o.ID] = o
	return nil
}

func TestServiceCreatePropagaFalhaDoArmazenamento(t *testing.T) {
	boom := errors.New("indisponível")
	svc := NewService(&fakeStore{orders: map[string]Order{}, saveErr: boom}, time.Now)
	if _, err := svc.Create(t.Context(), NewOrder{Name: "a"}); !errors.Is(err, boom) {
		t.Fatalf("esperado erro embrulhando %v, recebido %v", boom, err)
	}
}
```

Para o cliente do SDK da AWS, declare no adapter uma interface só com os métodos usados (`ReceiveMessage`, `DeleteMessage`) e use um fake dela. O que depende do serviço real fica em teste de integração (abaixo).

## HTTP: o mesmo teste nos dois runtimes

O router é um `http.Handler`: teste-o com `httptest.NewRecorder` e `httptest.NewRequest` (modo container) e, para provar a ponte da Lambda, pelo `httpadapter.NewV2(router).ProxyWithContext` com um `events.APIGatewayV2HTTPRequest`, como o `router_test.go` faz. Um helper monta o evento:

```go
func lambdaRequest(method, path, body string) events.APIGatewayV2HTTPRequest {
	return events.APIGatewayV2HTTPRequest{
		RawPath: path,
		Headers: map[string]string{"content-type": "application/json"},
		Body:    body,
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{Method: method, Path: path},
		},
	}
}

func TestRouterNosDoisRuntimes(t *testing.T) {
	t.Run("container", func(t *testing.T) {
		rec := httptest.NewRecorder()
		newRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/example-go", nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("status esperado 200, recebido %d", rec.Code)
		}
	})
	t.Run("lambda", func(t *testing.T) {
		resp, err := httpadapter.NewV2(newRouter()).ProxyWithContext(t.Context(), lambdaRequest(http.MethodGet, "/example-go", ""))
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("status esperado 200, recebido %d", resp.StatusCode)
		}
	})
}
```

- Verifique status, `content-type` e o corpo **decodificado** (`json.NewDecoder(rec.Body).Decode`), não a string crua.
- Cubra o que o handler decide: erro do núcleo para status (404, 409, 422), corpo inválido (400) e grande demais (413). O 404 e o 405 de rota são da stdlib e não precisam de teste.
- `httptest.NewServer` só quando o teste precisa de rede de verdade (cliente HTTP, TLS); o recorder basta para handler.
- `runtime.go` (`runningOnLambda`, `listenAddress`) testa-se com `t.Setenv`, como o `runtime_test.go`. O `serve` e o shutdown no `SIGTERM` ficam para teste manual ou de integração: não force um `os.Exit` em teste unitário.

## Fila: handler e núcleo

O handler da Lambda recebe um `events.SQSEvent` montado à mão e devolve `events.SQSEventResponse`; verifique que **só** as mensagens ruins aparecem em `BatchItemFailures`, como o `adapters_test.go` gerado:

```go
func TestHandleSQSReportaApenasMensagensComFalha(t *testing.T) {
	event := events.SQSEvent{Records: []events.SQSMessage{
		{MessageId: "msg-ok", Body: `{"action":"a"}`},
		{MessageId: "msg-ruim", Body: "não é json"},
	}}
	response, err := handleSQS(t.Context(), event)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(response.BatchItemFailures) != 1 || response.BatchItemFailures[0].ItemIdentifier != "msg-ruim" {
		t.Fatalf("falhas esperadas [msg-ruim], recebidas %+v", response.BatchItemFailures)
	}
}
```

Teste também mensagem duplicada (idempotência) e envelope inválido. Evento grande ou real vai para `testdata/<nome>.json` e é lido com `os.ReadFile` e `json.Unmarshal` em `events.SQSEvent` (o diretório `testdata` é ignorado pelas ferramentas do Go). Mais em skill-go-queue-patterns.

## Tempo

Injete o relógio (`func() time.Time` ou uma interface `Clock`) em vez de chamar `time.Now()` no núcleo. Para lógica com timeout, retry ou ticker, `testing/synctest` (estável desde o Go 1.25) roda em uma "bolha" com relógio virtual: o `time.Sleep` e o `context.WithTimeout` avançam sem esperar.

```go
func TestEsperaRespeitaTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		err := esperar(ctx, time.Hour) // esperar: a função sob teste
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("esperado DeadlineExceeded, recebido %v", err)
		}
	})
}
```

Dentro da bolha, evite rede e goroutine que sobreviva ao teste. Nunca use `time.Sleep` real para "dar tempo" a uma goroutine.

## Golden, fuzz, benchmark e cobertura

Só quando ajudam, com receitas em [`references/fuzz-golden-cobertura.md`](references/fuzz-golden-cobertura.md): **golden** para saída longa e estável (`testdata/<nome>.golden` e flag `-update`); **fuzz** para parser de entrada externa (sem `-fuzz`, o `go test` roda só as sementes e o `testdata/fuzz` commitado, então entra no target `test`); **benchmark** com `b.Loop()` (Go 1.24+) e um número a defender. O target `test` já imprime `coverage: X% of statements`; o repositório **não impõe limite** em Go.

## Integração com o Floci

Teste que usa SQS, DynamoDB ou SSM de verdade fica atrás de **build tag**, fora do `go test` padrão do target:

```go
//go:build integration

package dynamostore_test
```

```bash
pnpm nx up infra-local                          # Floci no ar
export AWS_ENDPOINT_URL=http://localhost:4566 AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
go test -tags integration ./...                 # dentro de apps/services/<svc>
```

Crie e apague os recursos do teste com nome único (sufixo aleatório) e `t.Cleanup`. O Floci não aplica IAM, então o teste não prova permissão. Não aponte um teste para uma conta AWS real.

## Armadilhas

| Armadilha | Prefira |
| --- | --- |
| `t.Setenv` com `t.Parallel()` | Um ou outro; `Setenv` fica em teste serial |
| `time.Sleep` para esperar goroutine | `synctest`, canal ou `WaitGroup` |
| Mock gerado para interface de 2 métodos | Fake manual |
| Asserção no corpo como string crua | Decodificar e comparar campos |
| Teste que depende de ordem de mapa ou da hora real | Ordenar, injetar relógio |
| Teste de integração no `go test` padrão | Build tag `integration` |
| Tornar o teste mais fraco para passar | Corrigir o código de produção |

## Checklist

- [ ] `pnpm nx test <svc>` passa (com `-race` e `-cover`); `go vet ./...` limpo.
- [ ] Núcleo testado em tabela, com casos de erro; portas substituídas por fakes manuais.
- [ ] Router testado no recorder **e** pelo `httpadapter`; handler de fila com `events.SQSEvent`.
- [ ] Relógio injetado ou `synctest`; nenhum `time.Sleep` real.
- [ ] Integração atrás de `//go:build integration`, apontada ao Floci por `AWS_ENDPOINT_URL`.

Veja também: skill-go, skill-go-http-patterns, skill-go-queue-patterns, [`docs/guides/servico-serverless.md`](../../../../../docs/guides/servico-serverless.md) e [`docs/guides/nx-tarefas.md`](../../../../../docs/guides/nx-tarefas.md).
