# example-go

Serviço serverless em Go, HTTP acionado pelo API Gateway (HTTP API), no runtime `provided.al2023`.

## Estrutura

- `internal/core/`: regras do serviço, sem dependência de runtime.
- `cmd/example-go/`: ponto de entrada. Com `AWS_LAMBDA_RUNTIME_API`
  definida (runtime da Lambda), usa `lambda.Start`; sem ela, sobe um servidor
  `net/http` na porta `PORT` (padrão `8080`) para rodar em container.
- Os logs saem em JSON no stdout (`slog` com `NewJSONHandler`), com o nível de
  `LOG_LEVEL` (`debug`, `info`, `warn` ou `error`). Só `cmd/` loga; o núcleo
  devolve erros. O `requestId` vem do contexto (use `slog.InfoContext` e
  variantes), e campo fora de `safeKeys`, em `runtime.go`, sai como
  `[redacted]`: para logar um campo novo, inclua a chave na lista.

## Modo container

```bash
PORT=8080 go run ./cmd/example-go
curl -i localhost:8080/health
curl localhost:8080/example-go
```

Na Lambda, o mesmo router atende o HTTP API pelo adaptador
`aws-lambda-go-api-proxy`.

## Imagem de container

O `Dockerfile` gera a imagem para EC2, ECS e EKS: binário estático
(`CGO_ENABLED=0`, sem a tag `lambda.norpc`) sobre
`distroless/static-debian12:nonroot`, usuário `65532`, porta `8080` e as duas
bases fixadas por digest. O contexto de build é a raiz do workspace e a
arquitetura é a do host. `GET /health` responde `204`.

```bash
pnpm nx docker:build example-go         # playground/example-go:<tag>
pnpm nx docker:run example-go           # HOST_PORT muda a porta do host
pnpm nx docker:push-floci example-go    # constrói e publica no ECR do Floci (playground-example-go)
pnpm nx apply infra-local-services      # deploy do container (Terraform), depois do push
```

O `docker:push-floci` depende do `docker:build`, não usa cache e faz o login, o
retag e o push sozinho; o repositório vem do `pnpm nx apply infra-local-platform`.
O deploy do container é o `apply` do `infra-local-services`, que depende do
`docker:push-floci` dos serviços. A tag (`sha-<commit>` ou
`sha-<commit>-dirty-<hash>`) vem de `tools/container/image-tag.sh`; os detalhes
estão em
[`docs/guides/imagens-de-container.md`](../../../docs/guides/imagens-de-container.md).

## Comandos

```bash
pnpm nx test example-go
pnpm nx build example-go                       # arquitetura do host, para o Floci
pnpm nx build example-go -c prod               # linux/arm64 em .bin/bootstrap.zip
pnpm nx run example-go:pre-deploy
pnpm nx run example-go:deploy                  # Floci (configuration padrão)
pnpm nx run example-go:deploy -c dev           # conta AWS, stage dev
pnpm nx run example-go:remove                  # Floci
```

O `build` compila `cmd/example-go` (declarado em
`custom.nxServerless.goPackage`) com `GOOS=linux CGO_ENABLED=0 -tags
lambda.norpc -trimpath -ldflags "-s -w"`. Na configuration `floci` (a padrão),
o binário usa a arquitetura do host, porque o Floci executa a Lambda em
container local; em `dev`, `homolog` e `prod`, vale a arquitetura de
`provider.architecture`.

Sem `-c`, os targets do Serverless usam a configuration `floci`, que aponta o
`AWS_ENDPOINT_URL` para `http://localhost:4566` com credenciais `test`. A
remoção em `prod` é bloqueada pelo plugin. O deploy em `prod` só roda no pipeline (`CI=true`) ou com `NX_SERVERLESS_ALLOW_PROD_DEPLOY=1`.

## Parâmetros

Os parâmetros por ambiente vêm do SSM, no caminho
`/playground/<stage>/<região>/example-go/<recurso>/<atributo>`, com valor padrão
no próprio `serverless.yml`.
