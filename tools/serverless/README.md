# nx-serverless

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground) [Métricas desta pasta no SonarQube Cloud](https://sonarcloud.io/code?id=mateusmacedo_playground&selected=mateusmacedo_playground%3Atools%2Fserverless)

Plugin Nx local que infere targets para serviços do Serverless Framework v4 a
partir de cada `serverless.yml` do workspace, com executors de validação e de
build Go e generators de serviços TypeScript e Go.

## Registro

O `tools/` fica fora do workspace pnpm, então o plugin entra no `nx.json` pelo
caminho relativo:

```json
{
  "plugin": "./tools/serverless",
  "options": {
    "defaultConfiguration": "floci",
    "defaultGoArchitecture": "arm64"
  }
}
```

Sem `serverlessCommand`, os targets chamam o `serverless` instalado na raiz
direto com `node` (`node ../../../node_modules/serverless/run.js`), sem passar
pelo `pnpm exec`, que roda o check de dependências do pnpm a cada comando. Sem
o pacote instalado, o comando cai para o `serverless` do PATH.

Os executors e generators são referenciados do mesmo jeito:
`./tools/serverless:validate`, `./tools/serverless:go-build`,
`./tools/serverless:service-ts` e `./tools/serverless:service-go`.

## Opções

| Opção                   | Padrão                  | Uso                                                                |
| ----------------------- | ----------------------- | ------------------------------------------------------------------ |
| `defaultConfiguration`  | `floci`                 | Configuration usada quando o comando não traz `-c`.                |
| `defaultGoArchitecture` | `arm64`                 | Arquitetura Go quando o manifesto não define uma.                  |
| `serverlessCommand`     | bin instalado           | Sobrescreve o CLI; sem ela, `node node_modules/serverless/run.js`. |
| `gradleCommand`         | `./gradlew`             | Comando do Gradle para os serviços Java, rodado da raiz.           |
| `flociEndpoint`         | `http://localhost:4566` | `AWS_ENDPOINT_URL` da configuration `floci`.                       |
| `flociRegion`           | `us-east-1`             | Região da configuration `floci`.                                   |
| `*TargetName`           | ver abaixo              | Renomeia `pre-deploy`, `package`, `deploy`, `remove` etc.          |

## Targets inferidos

| Target         | Linguagem | Cache | Depende de                       | Configurations            |
| -------------- | --------- | ----- | -------------------------------- | ------------------------- |
| `pre-deploy`   | todas     | sim   | `build` (Go, Java)               | floci, dev, homolog, prod |
| `package`      | todas     | não   | `pre-deploy`, `build` (Go, Java) | floci, dev, homolog, prod |
| `deploy`       | todas     | não   | `pre-deploy`, `build` (Go, Java) | floci, dev, homolog, prod |
| `pre-remove`   | todas     | não   |                                  | floci, dev, homolog       |
| `remove`       | todas     | não   | `pre-remove`                     | floci, dev, homolog       |
| `invoke-local` | todas     | não   | `build` (Go, Java)               | floci, dev, homolog       |
| `build`        | Go, Java  | sim   |                                  | floci, dev, homolog, prod |
| `test`         | Go        | sim   |                                  |                           |
| `lint`         | Go        | sim   |                                  |                           |

Em Go, o `lint` roda na raiz do projeto: falha listando os arquivos que o
`tools/go-fmt-check.sh` aponta (o `gofmt -l` dos `.go` versionados e novos,
mesmo script do `ci.yml` e do `release.yml`) e, se não houver nenhum, roda o
`go vet ./...`. Os inputs são os `.go`, o `go.mod`, o `go.sum`, a versão do Go
e o próprio script.

Em TypeScript, `typecheck`, `lint` e `test` continuam com os plugins
`@nx/js`, `@nx/eslint` e `@nx/vitest`.

A linguagem vem de `custom.nxServerless.language` (`typescript`, `go` ou
`java`); sem ela, de `tsconfig.json`, `go.mod` ou de um `build.gradle(.kts)`
com o plugin `io.quarkus` na raiz do projeto.

### Java (Quarkus com Gradle)

O `build` delega ao Gradle a partir da raiz do workspace:
`./gradlew <projeto>:quarkusBuild --console=plain`, que gera o zip sem passar
pelo `check`. O `test` e os demais targets do Gradle vêm do `@nx/gradle`, que
infere a mesma raiz; o plugin não os declara para não sobrescrevê-los. Os
inputs do build incluem `^production`, para que mudanças em projetos Gradle
aninhados (como um `core`) invalidem o cache. O projeto Gradle vem de
`custom.nxServerless.gradleProject` ou, sem a chave, do caminho do projeto
(`apps/services/x` vira `:apps:services:x`).

- Configuration `floci` (a padrão): build JVM, rápido para o ciclo local.
- `dev`, `homolog` e `prod`: build nativo, com
  `-Dquarkus.native.enabled=true -Dquarkus.native.container-build=true
  -Dquarkus.package.jar.enabled=false` (o Quarkus no Gradle não gera nativo e
  JAR juntos).

O artefato é o `package.artifact` do manifesto. Como o runtime muda entre JVM
(`java21`) e nativo (`provided.al2023`), o manifesto pode usar
`runtime: ${param:runtime}` com `params` por stage; o `validate` resolve essa
forma pelo stage, com fallback em `params.default`.

### Configurations

| Configuration | Stage     | Ambiente                                                             |
| ------------- | --------- | -------------------------------------------------------------------- |
| `floci`       | `local`   | `AWS_ENDPOINT_URL` do Floci, credenciais `test` e `SLS_ARCH` do host |
| `dev`         | `dev`     | Credenciais AWS do ambiente                                          |
| `homolog`     | `homolog` | Credenciais AWS do ambiente                                          |
| `prod`        | `prod`    | Credenciais AWS do ambiente                                          |

Sem configuration, os comandos do Serverless falham de propósito. Isso só
acontece quando a `defaultConfiguration` escolhida não existe no target (por
exemplo, `prod` no `remove`).

O Nx só repassa às dependências a configuration pedida na linha de comando.
Por isso o `build` Go também tem `defaultConfiguration`: `nx run svc:deploy`
compila para o host (Floci) e `nx run svc:deploy -c prod` compila para a
arquitetura do manifesto.

## Executors

### validate

Recusa o deploy quando:

- falta `custom.nxServerless` ou a linguagem declarada difere da inferida;
- `provider.name` não é `aws`, o `service` não é kebab-case ou há `extends`;
- o stage não está em `local`, `dev`, `homolog` ou `prod`;
- o runtime não é `nodejs*` (TypeScript), `provided.al2023` (Go) ou um de
  `java21` e `provided.al2023` (Java), resolvendo `${param:<nome>}` pelo stage;
- falta `package.json`/`tsconfig.json` (TypeScript), `go.mod` (Go) ou
  `build.gradle(.kts)` (Java);
- `custom.nxServerless.goPackage` aponta para um pacote sem `main.go`;
- falta o artefato de `package.artifact` (em Go, `.bin/bootstrap.zip` por
  padrão) em deploy ou package.

A remoção em `prod` é bloqueada: o target `remove` não tem configuration
`prod` e o `pre-remove` recusa o stage. O `remove` não repassa argumentos ao
CLI, para que um `--stage` extra não troque o stage validado.

O `deploy -c prod` só roda com `CI=true` ou `NX_SERVERLESS_ALLOW_PROD_DEPLOY=1`. O
guard (`PROD_DEPLOY_GUARD`, em `src/core/target-builders.ts`) vai no comando da
configuration `prod` do `deploy`: o `pre-deploy` é cacheado e o `package` também
o usa, então ele não serve de portão.

### go-build

Compila com `GOOS=linux CGO_ENABLED=0 go build -buildvcs=false -trimpath -tags
lambda.norpc -ldflags "-s -w"` e grava `.bin/bootstrap.zip` com data fixa e o
bit de execução, então o artefato é reprodutível.

## Generators

```bash
pnpm nx g ./tools/serverless:service-ts orders-api --type=http
pnpm nx g ./tools/serverless:service-go payments --type=sqs --architecture=arm64
```

Tipos: `http` (HTTP API), `sqs` (fila com DLQ) e `scheduled` (EventBridge). Os
serviços vão para `apps/services/<nome>`, com `frameworkVersion: '4'`,
`stage: ${opt:stage, 'local'}` e parâmetros em
`${ssm:/playground/<stage>/<região>/<serviço>/<recurso>/<atributo>, <padrão>}`.

O código separa o núcleo do runtime, para que o mesmo serviço possa ir para a
Lambda e, no futuro, para container:

- TypeScript: o caso de uso fica em `src/core/`, sem tipos de `aws-lambda`, e o
  handler fino em `src/entrypoints/lambda.ts`, para onde o `serverless.yml`
  aponta.
- Go: o caso de uso fica em `internal/core/` e o ponto de entrada em
  `cmd/<nome>/`. Com `AWS_LAMBDA_RUNTIME_API` definida, ele chama
  `lambda.Start`; sem ela, sobe `net/http` na porta `PORT` (padrão `8080`),
  com health check em `GET /health`.
- Nas duas linguagens, os entrypoints logam em JSON no stdout, com o nível de
  `LOG_LEVEL`, e o núcleo não loga. No
  tipo `http`, o mesmo router atende a Lambda pelo `aws-lambda-go-api-proxy`.
  O manifesto declara `custom.nxServerless.goPackage: cmd/<nome>`, que o
  `build` compila; sem a chave, o plugin usa o único `cmd/*/main.go` ou a raiz.

Targets de deploy para ECS, EKS ou EC2 ainda não existem.

No tipo `sqs`, a opção `--queue` define o dono da fila
([ADR 0004](../../docs/adr/0004-serverless-e-terraform.md)):

- `external` (padrão): a fila e a redrive policy são do Terraform (ou, no
  local, do bootstrap do Floci). O serviço só declara o gatilho e lê
  `${ssm:/playground/${sls:stage}/${aws:region}/<serviço>/queue/arn}` e
  `.../queue/url`; o deploy falha se o contrato não existir. Com
  `--queueParam=<domínio>/<recurso>` o serviço lê outro contrato, por exemplo
  `--queueParam=shared/sample-events-queue` para consumir a fila compartilhada
  semeada no Floci.
- `owned`: o `serverless.yml` cria a fila e a DLQ. Só para fila descartável de
  um único consumidor, porque o `remove` apaga a fila e as mensagens.

Sem `--skipPackageJson`, os generators adicionam `serverless`,
`serverless-localstack` e, em TypeScript, `@types/aws-lambda` ao `package.json`
da raiz. O generator Go roda `go mod tidy` ao final, salvo com
`--skipGoModTidy`.

## Chamando a HTTP API no Floci

O Floci expõe a HTTP API de um serviço em
`http://localhost:4566/_aws/execute-api/<apiId>/$default/<rota>` (ou em
`http://<apiId>.execute-api.localhost.localstack.cloud:4566/<rota>`). O
`apiId` sai de `GET http://localhost:4566/v2/apis`, pelo nome
`local-<serviço>`.

## Por que o serverless-localstack

O Serverless 4.46 resolve as variáveis (`${ssm:}`, `${aws:accountId}` e, pelos
ADRs do projeto de referência, `${cf:}` e `${s3:}`) antes de carregar os
plugins, com o AWS SDK v3, que respeita `AWS_ENDPOINT_URL`; por isso a
configuration `floci` injeta essa variável. Já o deploy (CloudFormation e S3)
usa o AWS SDK v2, que a ignora: sem o plugin, o `package` falha com `The
security token included in the request is invalid` na AWS real. Os templates
ativam o plugin só no stage `local`.

## Cache de inferência

Os targets inferidos ficam em cache em `.nx/workspace-data`, com chave nos
arquivos do serviço, nas opções do plugin e no código do próprio plugin. Mudar
um comando ou uma flag em `tools/serverless/src` invalida o cache sem precisar
de `nx reset`.

## Próximos passos

- **`golangci-lint` no Go**: o `lint` atual cobre só `gofmt` e `go vet`. O
  passo seguinte é trocar o comando por `golangci-lint run` com um
  `.golangci.yml` na raiz, o que exige instalar a ferramenta no ambiente local
  e no CI.
- **Generator `service-java`**: ainda não existe; os serviços Java partem do
  `example-quarkus`. A proposta é `service-java <nome> --type=http` gerar o
  app Quarkus e o `core` aninhado, incluir os dois no `settings.gradle` da raiz
  e criar o `serverless.yml` com `params` de runtime (`java21` no `local`,
  `provided.al2023` nos demais stages). Depende de fixar com o dono do
  `example-quarkus` as convenções do template (catálogo de versões, Spotless,
  layout app + core e configuração do nativo) e de uma geração real
  coordenada, porque ela altera o `settings.gradle` e roda o Gradle.

## Testes

```bash
pnpm nx test nx-serverless
pnpm nx typecheck nx-serverless
pnpm nx lint nx-serverless
```
