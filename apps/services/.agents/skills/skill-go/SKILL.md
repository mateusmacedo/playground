---
name: skill-go
description: >-
  Guia de Go dos serviços em `apps/services/*` (módulo `apps/services/<svc>`, Go 1.26): núcleo puro em `internal/core`,
  entrypoint em `cmd/<svc>` que escolhe Lambda ou container por `AWS_LAMBDA_RUNTIME_API`, router `net/http`,
  `aws-lambda-go-api-proxy`, `slog` JSON, shutdown no SIGTERM e `PORT`. Use ao escrever, editar ou revisar arquivos `.go`,
  ao criar serviço com `service-go` ou ao decidir erros, context, interfaces e generics. NÃO usar para rotas e middlewares
  (skill-go-http-patterns), acesso a dados (skill-go-db-patterns), SQS (skill-go-queue-patterns) nem testes (skill-go-testing).
---

# Go nos serviços do monorepo

Convenções gerais do repositório estão em [`AGENTS.md`](../../../../../AGENTS.md); aqui fica só o que é específico de Go.

> **Status.** Existem `apps/services/example-go` e o generator `service-go` do plugin `tools/serverless`. O deploy é só no Floci. **Roadmap, ainda não existe:** `@nx-go/nx-go`, o destino em container (ECS, EKS, EC2) e o adapter `main-http` do [ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md). O `cmd/<svc>` atual já traz a decisão Lambda ou servidor HTTP, mas o container não foi implantado nem testado.

## Como o Go entra no Nx

O Go é gerenciado pelo plugin local `tools/serverless`, que lê `custom.nxServerless` no `serverless.yml` e infere os targets. O `project.json` só declara nome e tags (`type:app`, `stack:go`, `platform:serverless`).

| Target | O que faz |
| --- | --- |
| `test` | `go test -race -cover ./...` (cacheado) |
| `build` | executor `go-build`: compila `cmd/<svc>` e gera `.bin/bootstrap.zip` |
| `pre-deploy`, `pre-remove` | executor `validate`: confere o `serverless.yml` contra as políticas |
| `package`, `deploy`, `remove`, `invoke-local` | `serverless` v4; deploy no Floci por padrão |

```bash
pnpm nx test example-go
pnpm nx build example-go            # arquitetura do host, para o Floci
pnpm nx show project example-go --json   # confira os targets antes de supor outros
```

O target Nx `lint` do serviço Go roda `tools/go-fmt-check.sh` (`gofmt -l`) e `go vet ./...`, com cache, e entra no `nx affected`; o Biome não formata `.go`. Antes de dar a tarefa por concluída, rode `pnpm nx lint <serviço>`. Serviço novo nasce de `pnpm nx g ./tools/serverless:service-go <nome> --type=http|sqs|scheduled` (use `--dry-run` antes); detalhes no [guia](../../../../../docs/guides/servico-serverless.md).

O `build` roda `go build -buildvcs=false -trimpath -tags lambda.norpc -ldflags "-s -w"` com `GOOS=linux` e `CGO_ENABLED=0`. A função usa `runtime: provided.al2023` e `handler: bootstrap`. `.bin/` e `.serverless/` ficam fora do git.

## Estrutura de um serviço

```text
apps/services/<svc>/
  go.mod             module apps/services/<svc>, go 1.26
  serverless.yml     custom.nxServerless: language go, type, goPackage cmd/<svc>
  internal/core/     regras e casos de uso, sem runtime
  cmd/<svc>/
    main.go          composition root: escolhe Lambda ou servidor HTTP
    router.go        http.Handler (ServeMux); em sqs/scheduled, lambda.go e server.go
    runtime.go       runningOnLambda, listenAddress, serve, writeJSON
```

O caminho do módulo é o caminho da pasta, então o import do núcleo é `apps/services/<svc>/internal/core`. O `internal/` impede que outro serviço importe o núcleo: serviços não dependem de serviços ([ADR 0009](../../../../../docs/adr/0009-camadas-e-ordem-de-implantacao.md)).

## Núcleo puro (`internal/core`)

Domínio e casos de uso **sem import de runtime**: nada de `aws-lambda-go`, `aws-sdk-go-v2`, `net/http` nem leitura de `os.Getenv`. Pode usar a stdlib pura (`context`, `errors`, `time`, `log/slog`, `encoding/json`). Tudo o que fala com o mundo entra como **interface declarada no núcleo** (porta) e é implementado fora dele.

```go
// Package core concentra as regras do serviço, sem dependência de runtime.
package core

type HelloResponse struct {
	Message string `json:"message"`
	Path    string `json:"path"`
}

func SayHello(path string) HelloResponse {
	return HelloResponse{Message: "Olá de example-go", Path: path}
}
```

## Entrypoint: o mesmo núcleo em dois runtimes

O `main.go` é fino e escolhe o runtime pela presença de `AWS_LAMBDA_RUNTIME_API` (definida só pelo runtime da Lambda, [ADR 0008](../../../../../docs/adr/0008-adapters-de-runtime.md)):

```go
func main() {
	router := newRouter()
	if runningOnLambda() {
		// o mesmo router atende os dois runtimes; na Lambda, o adaptador
		// converte o payload 2.0 do HTTP API em requisição net/http.
		lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
		return
	}
	serve(router)
}

func runningOnLambda() bool {
	_, ok := os.LookupEnv("AWS_LAMBDA_RUNTIME_API")
	return ok
}
```

`serve` (em `runtime.go`) lê `PORT` (padrão `8080`), cria `http.Server` com `ReadHeaderTimeout: 5 * time.Second`, usa `signal.NotifyContext` com `SIGTERM` e `os.Interrupt` e chama `server.Shutdown` com timeout de 10 s; `http.ErrServerClosed` não é erro. Em serviço `sqs` e `scheduled`, o `main` chama `lambda.Start(handleSQS)` ou `lambda.Start(handleSchedule)`, handlers finos que convertem o evento e delegam ao núcleo. Padrões de rota e middleware: skill-go-http-patterns.

### Contrato de execução (container)

| Item | Regra |
| --- | --- |
| Porta | variável `PORT`, padrão `8080` |
| Health | `GET /health` (contrato do ADR 0008); o `example-go` e os templates ainda expõem `/healthz`, alinhe ao contrato ao mexer no router |
| Logs | JSON no stdout, via `slog` |
| Encerramento | shutdown gracioso no `SIGTERM`, drenando requisições em voo |
| Estado | stateless; nada em disco local nem em memória que precise sobreviver |
| Configuração | variável de ambiente e SSM (via `serverless.yml`); segredo no Secrets Manager |

### Logs e configuração

O `example-go` chama `slog.Info` sem configurar handler, e o handler padrão do `slog` escreve texto, não JSON. Padrão a seguir no `main` antes de qualquer log:

```go
func newLogger() *slog.Logger {
	var level slog.Level
	// LOG_LEVEL vem do SSM pelo serverless.yml; valor inválido cai em INFO.
	if err := level.UnmarshalText([]byte(os.Getenv("LOG_LEVEL"))); err != nil {
		level = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
}
// slog.SetDefault(newLogger())
```

Leia a configuração **uma vez**, no `main`, valide e falhe no boot (`os.Exit(1)` com log) em vez de falhar na primeira requisição. Passe valores ao núcleo por construtor; o núcleo não lê o ambiente. Nunca logue segredo, token nem corpo de requisição inteiro.

## Convenções de código

| Tema | Regra |
| --- | --- |
| Formatação | `gofmt` sem diff; imports em dois grupos (stdlib, depois módulo e externos) |
| Nomes | pacote minúsculo e curto, sem `_`; acrônimos em maiúsculas (`UserID`, `URLParser`); receiver de 1 a 2 letras; sem prefixo `Get` em getter; booleano com `Is`, `Has`, `Can` |
| Interfaces | pequenas, declaradas **no consumidor** (o núcleo); "aceite interfaces, devolva structs" |
| Erros | valor retornado `(T, error)`; `fmt.Errorf("contexto: %w", err)`; `errors.Is`/`errors.As`; nunca comparar `err.Error()`; `panic` só para violação de invariante |
| Context | primeiro parâmetro em todo I/O; propague o `ctx` do handler (na Lambda ele carrega o deadline); `context.Background()` só no `main` e em testes |
| Concorrência | toda goroutine tem dono, `ctx` para cancelar e ponto de término; `errgroup` para paralelismo com erro; `go test -race` é o padrão do target |
| Tipos | `any` em vez de `interface{}`; generics só para coleção ou utilitário genuinamente polimórfico; sem getter e setter triviais |
| Variável de laço | por iteração desde o Go 1.22: não precisa de `tt := tt` |
| Comentários | godoc começa pelo nome; no código, explique o porquê com `WHY:` ou `NOTE:`, em PT-BR como o `example-go` |

Receitas de erro (sentinela, tipo, mapeamento para HTTP), `context`, `errgroup` e `defer` estão em [`references/erros-context-concorrencia.md`](references/erros-context-concorrencia.md). Interfaces, receivers, embedding e generics, em [`references/interfaces-e-tipos.md`](references/interfaces-e-tipos.md).

## Armadilhas

| Armadilha | Prefira |
| --- | --- |
| Criar cliente AWS ou abrir conexão dentro do handler | Criar no `main` (uma vez por cold start) e injetar |
| Trabalho de I/O em `init()` | Fazer no `main`, com erro tratado |
| `http.ListenAndServe` direto, sem `Server` | `http.Server` com `ReadHeaderTimeout` e `Shutdown` |
| `http.DefaultServeMux` e variáveis globais mutáveis | `http.NewServeMux()` e injeção por construtor |
| `time.Now()` espalhado no núcleo | Injetar um relógio (`type Clock interface{ Now() time.Time }`) |
| Importar `aws-lambda-go` ou o SDK em `internal/core` | Porta no núcleo, adapter em `cmd/` ou em pacote próprio |
| Commitar `.bin/` ou `.serverless/` | Já estão no `.gitignore` do serviço |
| Assumir arquitetura | No Floci o binário usa a do host; nos outros stages, `provider.architecture` (padrão `arm64`) |

## Checklist

- [ ] `pnpm nx test <svc>` e `pnpm nx build <svc>` passam; `gofmt -l .` vazio; `go vet ./...` limpo.
- [ ] `internal/core` sem import de runtime; portas declaradas no núcleo.
- [ ] `main.go` fino, com `runningOnLambda()`; `PORT`, `/health`, `slog` JSON e `SIGTERM` tratados.
- [ ] Erros embrulhados com `%w`; `ctx` como primeiro parâmetro em todo I/O.
- [ ] `serverless.yml` com `custom.nxServerless`; parâmetros no caminho SSM canônico.

Veja também: [`docs/adr/0008-adapters-de-runtime.md`](../../../../../docs/adr/0008-adapters-de-runtime.md), [`docs/adr/0004-serverless-e-terraform.md`](../../../../../docs/adr/0004-serverless-e-terraform.md), [`docs/guides/servico-serverless.md`](../../../../../docs/guides/servico-serverless.md) e `apps/services/example-go`.
