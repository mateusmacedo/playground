# example-go: instruções para agentes

Serviço HTTP de exemplo em Go, que roda como Lambda ou em container com o mesmo binário. As convenções comuns de serviço estão no [`AGENTS.md`](../AGENTS.md) de `apps/services` e as de Go na rule `services-go`; estrutura, modo container, imagem e comandos, no [`README.md`](./README.md).

- Núcleo em `internal/core`; entrypoint em `cmd/example-go/`. O `runtime.go` escolhe o modo por `AWS_LAMBDA_RUNTIME_API`: com ela, `lambda.Start`; sem ela, servidor `net/http` na porta `PORT` (padrão `8080`). O mesmo router atende os dois, pelo `aws-lambda-go-api-proxy` na Lambda.
- Só `cmd/` loga (`slog` JSON no stdout, nível de `LOG_LEVEL`); o núcleo devolve erros.
- O `go.mod` daqui define a versão de Go que o CI instala (`go-version-file` da action `setup`): mudar a versão aqui muda a do CI.
- Tarefas pelo Nx: `pnpm nx test example-go`, `pnpm nx build example-go` e `pnpm nx run example-go:deploy` (Floci, a configuration padrão).
