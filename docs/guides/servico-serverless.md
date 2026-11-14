# Guia: serviço serverless

Como criar, testar e implantar um serviço com o **Serverless Framework v4** neste monorepo, usando o plugin Nx local em `tools/serverless` (projeto `nx-serverless`). Os exemplos de referência estão em `apps/services/example-ts` e `apps/services/example-go`.

> **Estado atual.** O plugin, os generators e os exemplos existem e o deploy no **Floci** é o caminho suportado. O deploy na **AWS** (stages `dev`, `homolog` e `prod`) está no roadmap: as configurations existem, mas ainda não há conta nem pipeline de deploy no repositório, e o Terraform só existe para o ambiente local ([ADR 0011](../adr/0011-estrutura-profissional-do-terraform.md)). Veja o [ADR 0004](../adr/0004-serverless-e-terraform.md).

## Como funciona

O plugin é registrado no `nx.json` por caminho (`"plugin": "./tools/serverless"`). Ele procura pastas com um `serverless.yml` que declare `custom.nxServerless` e **infere os targets** do projeto, sem `scripts` em `package.json`.

```yaml
custom:
  nxServerless:
    language: typescript # ou go
    type: http # http, sqs ou scheduled
```

A linguagem vem de `custom.nxServerless.language` (`typescript`, `go` ou `java`); sem ela, o plugin olha para o que existe na pasta: `tsconfig.json` indica TypeScript, `go.mod` indica Go e um `build.gradle(.kts)` com o plugin `io.quarkus` indica Java. Se a inferência for ambígua ou não achar nada, ela falha com uma mensagem pedindo a declaração.

O suporte a **Java (Quarkus com Gradle)** está descrito na seção [Serviço Java (Quarkus)](#serviço-java-quarkus) e no [`tools/serverless/README.md`](../../tools/serverless/README.md).

Os targets chamam o CLI do `serverless` instalado na raiz **direto com `node`** (`node .../node_modules/serverless/run.js`), sem passar pelo `pnpm exec`, que roda o check de dependências do pnpm a cada comando. Isso deixa o `package` cerca de 5 vezes mais rápido (de 34,7 s ou 9,8 s para 6,7 s, segundo a medição do plugin). A opção `serverlessCommand` existe só como override, e sem o pacote instalado o comando cai para o `serverless` do PATH.

### Targets

| Target          | O que faz                                                                                        | Configurations                    |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| `pre-deploy`    | Valida o `serverless.yml` contra as políticas do monorepo (cacheado).                            | `floci`, `dev`, `homolog`, `prod` |
| `package`       | `serverless package`; depende do `pre-deploy`. Saída em `.serverless` (ignorada pelo git).       | `floci`, `dev`, `homolog`, `prod` |
| `deploy`        | `serverless deploy`; depende do `pre-deploy`.                                                    | `floci`, `dev`, `homolog`, `prod` |
| `pre-remove`    | Valida a remoção. **Bloqueia `prod`.**                                                           | `floci`, `dev`, `homolog`         |
| `remove`        | `serverless remove`; depende do `pre-remove`.                                                    | `floci`, `dev`, `homolog`         |
| `invoke-local`  | `serverless invoke local`; passe `--function=<nome>`.                                            | `floci`, `dev`, `homolog`         |
| `build` (só Go) | Compila o binário e gera `.bin/bootstrap.zip`. `package`, `deploy` e `pre-deploy` dependem dele. | `floci`                           |
| `test` (só Go)  | `go test -race -cover ./...`.                                                                    | -                                 |

O `build` de Go tem a própria `defaultConfiguration`: `nx deploy <serviço>` compila para a arquitetura da **sua máquina** (o Floci roda a Lambda em container local), e `nx deploy <serviço> -c prod` compila para a arquitetura do manifesto. Isso vale porque o Nx só repassa às dependências a configuration pedida na linha de comando, e por isso o `build` precisa ter o próprio padrão.

Em TypeScript, `test`, `lint` e `typecheck` vêm dos plugins `@nx/vitest`, `@nx/eslint` e `@nx/js/typescript`, e não existe target `build`: o empacotamento é feito pelo Serverless Framework.

Confirme sempre no projeto:

```bash
pnpm nx show project example-ts --json
```

### Configurations por stage

| Configuration | Stage     | O que muda                                                                                                                                                                            |
| ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `floci`       | `local`   | `--stage local` e variáveis para falar com o Floci: `AWS_ENDPOINT_URL=http://localhost:4566`, região `us-east-1`, credenciais `test`/`test`, `SLS_ARCH` com a arquitetura da máquina. |
| `dev`         | `dev`     | `--stage dev`, com as credenciais AWS do seu ambiente.                                                                                                                                |
| `homolog`     | `homolog` | `--stage homolog`, idem.                                                                                                                                                              |
| `prod`        | `prod`    | `--stage prod`, idem. Sem `remove` nem `invoke-local`.                                                                                                                                |

A configuration **padrão é `floci`**: `pnpm nx deploy example-ts` sem `-c` vai para o ambiente local, nunca para uma conta real. Para outro stage, passe `-c` de forma explícita.

## Pré-requisitos

- Ambiente local no ar: `pnpm nx up infra-local` ([guia do Floci](../onboarding/local-aws-floci.md)).
- **Serverless Framework v4** com login: `serverless login` ou a variável `SERVERLESS_ACCESS_KEY`. O `serverless` é dependência da raiz (os generators a adicionam ao `package.json`), e o plugin o chama direto, sem `npx`.
- **TypeScript**: Node 24 (o runtime padrão da Lambda é `nodejs24.x`).
- **Go**: toolchain Go instalada; o `go.mod` dos exemplos usa Go 1.26.
- **Java (Quarkus)**: JDK 21 e o wrapper `./gradlew` da raiz (Gradle 9.7.0). O **build nativo** (stages `dev`, `homolog` e `prod`) exige também Docker, porque o Mandrel roda em container.

## Criar um serviço

O plugin traz dois generators. Como o plugin é local, o gerador é chamado pelo caminho:

```bash
pnpm nx g ./tools/serverless:service-ts my-service --type=http --dry-run
pnpm nx g ./tools/serverless:service-ts my-service --type=http

pnpm nx g ./tools/serverless:service-go my-service --type=sqs
```

Rode primeiro com `--dry-run` para ver o que será criado. O serviço nasce em `apps/services/<nome>`.

| Opção               | Padrão                 | Descrição                                                                                                                                                              |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | (obrigatória)          | Nome em kebab-case; vira o nome do projeto Nx e o `service`.                                                                                                           |
| `--type`            | `http`                 | Gatilho: `http` (API Gateway HTTP API), `sqs` (consumidor de fila) ou `scheduled` (EventBridge, `rate` ou `cron`).                                                     |
| `--directory`       | `apps/services/<name>` | Onde criar.                                                                                                                                                            |
| `--domain`          | -                      | Domínio de negócio; gera a tag `scope:<domain>`.                                                                                                                       |
| `--tags`            | -                      | Tags extras do Nx, separadas por vírgula.                                                                                                                              |
| `--memorySize`      | `256`                  | Memória da Lambda em MB.                                                                                                                                               |
| `--timeout`         | `29`                   | Timeout em segundos (o HTTP API corta em 30 s).                                                                                                                        |
| `--skipFormat`      | `false`                | Não formata os arquivos gerados.                                                                                                                                       |
| `--skipPackageJson` | `false`                | Não adiciona as dependências do Serverless ao `package.json` da raiz.                                                                                                  |
| `--queue`           | `external`             | Só no tipo `sqs`: quem é dono da fila. `external` (padrão): o serviço só declara o gatilho e lê o ARN e a URL do SSM. `owned`: o `serverless.yml` cria a fila e a DLQ. |
| `--queueParam`      | `<serviço>/queue`      | Só no tipo `sqs` com `--queue=external`: `<domínio>/<recurso>` do contrato SSM da fila. Ex.: `shared/sample-events-queue`.                                             |

Só no `service-ts`: `--runtime` (padrão `nodejs24.x`). Só no `service-go`: `--goVersion` (padrão `1.26`), `--architecture` (`arm64` ou `amd64`, padrão `arm64`), `--modulePath` e `--skipGoModTidy`.

O gerador adiciona ao `package.json` da raiz as dependências do Serverless (`serverless`, `serverless-localstack` e, em TypeScript, `@types/aws-lambda`). Depois de gerar, rode:

```bash
pnpm install
pnpm nx sync
pnpm nx show project my-service --json
```

### Estrutura gerada

Os templates separam o **núcleo** (o caso de uso) do **entrypoint** de runtime, para o mesmo código poder ir para Lambda e, depois, para container ([ADR 0008](../adr/0008-adapters-de-runtime.md)):

| Linguagem      | Núcleo                                 | Entrypoint                                                                    |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| **TypeScript** | `src/core/`, sem tipos de `aws-lambda` | `src/entrypoints/lambda.ts`, handler fino para onde o `serverless.yml` aponta |
| **Go**         | `internal/core/`                       | `cmd/<nome>/`, com `runtime.go` escolhendo o modo                             |

Em **Go**, o `runtime.go` escolhe o modo pela variável `AWS_LAMBDA_RUNTIME_API`:

- **Definida** (dentro da Lambda): chama `lambda.Start`.
- **Ausente**: sobe um servidor `net/http` na porta `PORT` (padrão `8080`), com o endpoint `GET /health` (o mesmo contrato de todas as stacks) e encerramento limpo no `SIGTERM`: o servidor espera as requisições em andamento por até 10 s antes de sair e define `ReadTimeout`, `WriteTimeout` e `IdleTimeout` (este acima dos 60 s de ociosidade do ALB).

No tipo `http`, o **mesmo router** atende os dois modos: na Lambda, pelo `aws-lambda-go-api-proxy`. O `serverless.yml` declara `custom.nxServerless.goPackage: cmd/<nome>`, que o `build` compila; sem a chave, o plugin usa o único `cmd/*/main.go` ou a raiz.

Em **TypeScript**, um runtime novo (container, por exemplo) entra como outro arquivo em `src/entrypoints/`, reaproveitando o `src/core/`. Hoje só existe o entrypoint de Lambda.

Os targets de deploy para ECS, EKS e EC2 **ainda não existem**.

### O que cada tipo traz

| Tipo        | Evento no `serverless.yml`                                                                                                                               | Recursos do serviço                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http`      | `httpApi` com `GET /<nome>`.                                                                                                                             | Nenhum.                                                                                                                                                                |
| `sqs`       | Mapeamento da fila para a função, em lotes de 10, com `ReportBatchItemFailures`.                                                                         | Com `--queue=external` (padrão), nenhum: a fila é do Terraform (ou, no Floci, do bootstrap). Com `--queue=owned`, a fila `<serviço>-<stage>` e a DLQ, em `resources:`. |
| `scheduled` | `schedule` com `rate` lida do SSM (`<serviço>/config/schedule`), padrão `rate(1 hour)`, e `maximumRetryAttempts: 1` e `maximumEventAge: 3600` na função. | Nenhum.                                                                                                                                                                |

**A fila do tipo `sqs`**, pela [regra de dono do ADR 0004](../adr/0004-serverless-e-terraform.md#2-regra-de-dono-aplicada-em-ordem):

- **`external` (padrão)**: a fila e a redrive policy são do **Terraform** (ou, no Floci, do bootstrap). O serviço só declara o gatilho e lê `${ssm:/playground/${sls:stage}/${aws:region}/<serviço>/queue/arn}` e `.../queue/url`. O **deploy falha se o contrato não existir** no SSM, e o `remove` **preserva a fila** e as mensagens.
- **`owned`**: o `serverless.yml` cria a fila e a DLQ. **Só serve para fila descartável de um único consumidor**, porque o `remove` apaga a fila e as mensagens pendentes.
- **`--queueParam=<domínio>/<recurso>`** troca o contrato lido. Para consumir a fila compartilhada que o bootstrap do Floci semeia: `--queueParam=shared/sample-events-queue`.

Por exemplo:

```bash
pnpm nx g ./tools/serverless:service-ts queue-consumer --type=sqs --queueParam=shared/sample-events-queue
```

A DLQ e o destino de falha **da própria função** seguem sendo do Serverless.

Cada serviço vem com o núcleo, o entrypoint, testes (`*.spec.ts` em TypeScript, `*_test.go` em Go), `README.md` e `.gitignore`. O generator de Go roda `go mod tidy` ao final, salvo com `--skipGoModTidy`.

## Serviço Java (Quarkus)

O `apps/services/example-quarkus` é o exemplo de referência: Java 21 com Quarkus, HTTP acionado pelo API Gateway (HTTP API), com build **Gradle** a partir da **raiz** do repositório. O README do próprio serviço ([`apps/services/example-quarkus/README.md`](../../apps/services/example-quarkus/README.md)) é a fonte dos detalhes; abaixo fica o que muda em relação aos serviços TypeScript e Go.

### Build e projetos

| Peça            | Valor                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Gradle          | 9.7.0, pelo wrapper `./gradlew` (com `distributionSha256Sum`), multi-projeto na raiz (`settings.gradle`) |
| Quarkus         | 3.40.1.2 (plugin e BOM, em `gradle.properties`)                                                          |
| Java            | toolchain 21                                                                                             |
| Grafo para o Nx | plugin Gradle `dev.nx.gradle.project-graph` 0.1.26 + `@nx/gradle` no `nx.json`                           |
| Formatação      | Spotless 8.11.0 com o Eclipse 4.41 (perfil em `tools/java/eclipse-formatter.xml`: 2 espaços, 80 colunas) |

O serviço são **dois projetos Gradle**, que viram dois projetos do Nx:

- `example-quarkus-core` (pasta `core/`): o domínio e os casos de uso em **Java puro**, **sem Quarkus no classpath**. É o que impede o núcleo de depender do runtime: o compilador barra o import.
- `example-quarkus` (pasta `src/`): a aplicação Quarkus. O recurso JAX-RS `HelloResource` traduz a requisição e chama o caso de uso; `UseCases` entrega os casos de uso do núcleo ao CDI.

O nome do projeto Gradle vira o nome do projeto no Nx, e a aplicação fica **na mesma pasta do `serverless.yml`**, para os targets do Gradle e os do plugin serverless caírem no mesmo projeto. O `@nx/gradle` também cria um projeto `playground`, que é a raiz do build Gradle e não tem código de serviço.

### Targets

| Origem                | Targets                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@nx/gradle`**      | `test`, `spotlessCheck`, `spotlessApply`, `quarkusDev`, `quarkusTest` e **todas** as demais tasks do Gradle: o `example-quarkus` chega a **93 targets** |
| **Plugin serverless** | `build` (executa `./gradlew :example-quarkus:quarkusBuild`), `pre-deploy`, `package`, `deploy`, `pre-remove`, `remove` e `invoke-local`                 |

O `build` do plugin **não** passa pelo `check`: só gera o zip. Fora do Nx, o equivalente do `test` é `./gradlew :example-quarkus:test`.

Detalhes que costumam surpreender:

- **Quem é dono do `build`.** No `example-quarkus`, o `build` é do **plugin serverless** (comando `quarkusBuild`, com `java -version` nos inputs). Não há conflito com o `@nx/gradle` porque o plugin serverless vem **depois** dele na lista de plugins do `nx.json`. No `example-quarkus-core`, o `build` é do **Gradle** (`@nx/gradle:gradle`) e roda o `check`, ou seja, **testes e Spotless**.
- **`buildTargetName` do `@nx/gradle` não tem efeito.** Com o `dev.nx.gradle.project-graph` 0.1.26, só `testTargetName`, `ciTestTargetName` e `targetNamePrefix` funcionam, mesmo a documentação do Nx dizendo o contrário. O `targetNamePrefix` vale para **todos** os targets, então não o use para "resolver" o nome do `build`. Por isso o `nx.json` declara só `ciTestTargetName: "test-ci"` para o `@nx/gradle`: a entrada `buildTargetName` foi removida.
- **Entradas dos targets do Gradle.** Eles têm como `inputs` o `settings.gradle`, o `build.gradle` da raiz e o do projeto (via `targetDefaults` com `filter.plugin: "@nx/gradle"`), e o input `production` exclui `src/test/**`. O `sharedGlobals` **não** alcança os targets do Gradle.
- **Grafo e JDK.** O grafo do Nx chama o `./gradlew`, que precisa de JDK 17 ou superior (o projeto usa 21). A **primeira** carga do grafo leva cerca de 27 s; as seguintes, cerca de 3 s, com cache.
- **Projetos que entram no grafo**: `example-quarkus`, `example-quarkus-core` (no Gradle o caminho é `:example-quarkus-core`) e `playground`, a raiz do build, sem targets úteis. Em commit que mexe só na raiz do Gradle, o scope do commitlint é **`workspace`**: o `playground` não é aceito como scope.

### Configurations do `build`

| Configuration            | Build                                                                                                                     | Runtime da Lambda | Artefato                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| `floci` (padrão)         | **JVM**, rápido para o ciclo local                                                                                        | `java21`          | `build/function.zip`                              |
| `dev`, `homolog`, `prod` | **Nativo**, com `-Dquarkus.native.enabled=true -Dquarkus.native.container-build=true -Dquarkus.package.jar.enabled=false` | `provided.al2023` | `build/function.zip` com o executável `bootstrap` |

O runtime vem do parâmetro `lambdaRuntime` do `serverless.yml`, por stage: `java21` no `local` e `provided.al2023` nos demais. O `provider.runtime` é `${param:lambdaRuntime}`, e o `pre-deploy` resolve essa forma pelo stage. O `package.individually: true` e o `package.artifact: build/function.zip` apontam o Serverless para o zip que o Gradle gerou.

O Quarkus, no Gradle, **não gera o JAR e o nativo na mesma execução**; por isso o build nativo desliga o JAR com `-Dquarkus.package.jar.enabled=false`. O `native-image` **não faz cross-compile**: o executável tem a arquitetura da máquina do build, e o `provider.architecture` padrão é `x86_64`. Para `arm64`, gere o build num runner arm64 e passe `SLS_ARCH=arm64`.

### Adapter de runtime (ADR 0008)

Diferente do TypeScript e do Go, no Quarkus a escolha do runtime é feita **no build**, e não na partida pela variável `AWS_LAMBDA_RUNTIME_API`:

| `-Pruntime=`      | Extensão                     | Artefato                            |
| ----------------- | ---------------------------- | ----------------------------------- |
| `lambda` (padrão) | `quarkus-amazon-lambda-http` | `build/function.zip`                |
| `container`       | nenhuma                      | `build/quarkus-app/quarkus-run.jar` |

A extensão de Lambda troca, no build, o servidor HTTP pelo loop de eventos da Lambda, então **o artefato de Lambda só roda dentro dela**. O mesmo código JAX-RS sobe como servidor HTTP comum no modo `container`:

```bash
./gradlew :example-quarkus:quarkusBuild -Pruntime=container
PORT=8080 java -jar apps/services/example-quarkus/build/quarkus-app/quarkus-run.jar
curl -i localhost:8080/health
curl localhost:8080/example-quarkus
```

O contrato de execução do [ADR 0008](../adr/0008-adapters-de-runtime.md) vale aqui: `PORT` (padrão `8080`), health em **`/health`** (com `/health/live` e `/health/ready`, pelo `quarkus-smallrye-health`), log em **JSON** no stdout e `SIGTERM` esperando até 10 s pelas requisições em andamento. A rota de negócio é `GET /example-quarkus`, no mesmo padrão `/<serviço>` dos exemplos TypeScript e Go. O nível de log vem de `LOG_LEVEL`, lido do SSM em `/playground/<stage>/<região>/example-quarkus/config/log-level`.

### Comandos

```bash
pnpm nx run-many -t test -p example-quarkus example-quarkus-core
pnpm nx run-many -t spotlessCheck -p example-quarkus example-quarkus-core
pnpm nx build example-quarkus                  # zip JVM, para o Floci
pnpm nx build example-quarkus -c prod          # zip nativo (precisa de Docker)
pnpm nx run example-quarkus:deploy             # Floci (configuration padrão)
pnpm nx run example-quarkus:remove             # Floci
```

No Floci, a HTTP API responde em `http://localhost:4566/_aws/execute-api/<apiId>/$default/example-quarkus`.

### Memória do build nativo

O `native-image` consome muita memória, e a máquina de desenvolvimento divide a RAM com o Floci, o Next.js e o editor. Por isso há tetos explícitos:

- No `application.properties`: `quarkus.native.native-image-xmx=2g` e `quarkus.native.container-runtime-options=--memory=3g` (o limite do container cobre o heap e o resto). Sem o teto, o `native-image` se dimensiona pela RAM da máquina.
- No `gradle.properties`: `org.gradle.workers.max=2`, `org.gradle.jvmargs=-Xmx1536m` e `org.gradle.daemon.idletimeout=900000` (15 minutos).

Medido numa máquina de 8 CPUs: o build nativo levou cerca de **8 min** (6 min no `native-image`), com pico de **2,7 GB** no builder e **1,6 GB** no Gradle. **Rode um build nativo por vez** e pare o daemon depois com `./gradlew --stop`.

### Medidas no Floci

| Build                      | Deploy                | Primeiro `GET` (a frio) | `GET` quente          |
| -------------------------- | --------------------- | ----------------------- | --------------------- |
| JVM (`java21`)             | cerca de 21 a 25 s    | 3 a 4 s, resposta 200   | cerca de 20 ms        |
| Nativo (`provided.al2023`) | não medido neste guia | 1,0 s, resposta 200     | não medido neste guia |

São medidas pontuais de uma máquina, para dar ordem de grandeza.

### Generator `service-java`

**Ainda não existe.** Os serviços Java partem do `example-quarkus`. A proposta do plugin é `service-java <nome> --type=http` gerar o app e o `core`, incluir os dois no `settings.gradle` e criar o `serverless.yml` com os `params` de runtime. Fica **a implementar**, porque altera o `settings.gradle` e roda o Gradle.

## Dia a dia

```bash
pnpm nx test example-ts                            # testes
pnpm nx typecheck example-ts                       # tipos (TypeScript)
pnpm nx build example-go                           # compila o binário (Go)

pnpm nx run example-ts:pre-deploy                  # só valida
pnpm nx run example-ts:invoke-local --function=handler
```

`invoke-local` executa a função na sua máquina, sem passar pelo Floci.

## Deploy no Floci

Com o `infra-local` no ar:

```bash
pnpm nx deploy example-ts            # configuration floci (padrão)
pnpm nx deploy example-go
```

O que acontece, em ordem:

1. O `pre-deploy` valida o serviço (e, em Go, o `build` gera `.bin/bootstrap.zip` antes).
2. O Nx roda `serverless deploy --stage local` com as variáveis da configuration `floci`.
3. O plugin `serverless-localstack`, declarado no `serverless.yml` e ativo só no stage `local`, redireciona ao Floci as chamadas de CloudFormation e S3. Ele é **obrigatório** no stage local: o Serverless v4 resolve as variáveis (`${ssm:}`, `${aws:accountId}`) com o AWS SDK v3, que respeita `AWS_ENDPOINT_URL`, mas o deploy em si (CloudFormation e S3) usa o AWS SDK v2, que a ignora. Sem o plugin, o `package` falha com `The security token included in the request is invalid`, porque a chamada vai para a AWS real.

A saída do deploy lista o endpoint HTTP. Para conferir o que subiu:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

aws lambda list-functions --query 'Functions[].FunctionName'
```

Para derrubar:

```bash
pnpm nx remove example-ts
```

> No Go, o binário do stage `floci` usa a **arquitetura da sua máquina**, porque o Floci executa a Lambda em um container local. Nas outras configurations vale a arquitetura do `provider.architecture` (padrão `arm64`).

### Limites do Floci que afetam o deploy

- O **IAM não é aplicado**: permissões da função que faltam no `serverless.yml` não falham localmente. Revise as policies à mão antes de ir para a AWS.
- Um recurso de CloudFormation sem suporte no Floci vira **stub**: a stack chega a `CREATE_COMPLETE` sem criar nada, só com um aviso no log do Floci (`pnpm nx logs infra-local`). Se algo "implantado" não aparecer, procure o aviso. `FLOCI_CFN_ALLOW_STUBS=false` faz a stack falhar nesse caso.

## Deploy na AWS (roadmap)

As configurations `dev`, `homolog` e `prod` existem e usam as credenciais AWS do seu ambiente:

```bash
pnpm nx deploy example-ts -c dev
```

Antes de usar, saiba o que **ainda não existe**: não há conta AWS configurada para o projeto, nem Terraform publicando os parâmetros SSM nela (o `infra/terraform` só existe para o Floci), nem pipeline de deploy. Sem os parâmetros, os serviços usam os valores padrão escritos no `serverless.yml`. Trate o deploy fora do Floci como experimental até esse trabalho existir.

Proteções do plugin:

- `remove` em `prod` **não existe** como configuration, e o `pre-remove` também o recusa. A mensagem manda seguir um runbook de descomissionamento; use o [modelo de runbook](../runbooks/TEMPLATE.md) para escrevê-lo quando o deploy em produção existir.
- `deploy -c prod` só roda com `CI=true` (o pipeline) ou, em emergência, com `NX_SERVERLESS_ALLOW_PROD_DEPLOY=1`. A guarda fica no comando da configuration `prod` do `deploy`: o `pre-deploy` é cacheado e o `package` também o usa, por isso ele não serve de portão.
- Sem `-c`, o padrão é sempre `floci`.

## Logs

- Formato mínimo comum a TypeScript, Go e Quarkus: `time`, `level` em minúsculas, `message` e `requestId`, quando houver. No Quarkus a chave é renomeada por `key-overrides`, mas o nível sai em maiúsculas e o id da invocação fica em `mdc.AWSRequestId`.
- O `requestId` vem do logger: na Lambda é o id da invocação; no container (Go), o cabeçalho `X-Request-Id` ou um id gerado.
- Os loggers de TypeScript e Go só emitem campos de uma lista de chaves seguras (`safeKeys`); o resto sai como `[redacted]`. Para logar um campo novo, inclua a chave na lista, com a certeza de que o valor não é segredo nem dado pessoal.
- Os templates e os exemplos declaram `provider.logRetentionInDays`: 7 dias por padrão e 30 em `prod` (`custom.logRetentionInDays`). Sem isso o grupo de logs da função nunca expira.

## Parâmetros SSM

Todo parâmetro segue a convenção de **três segmentos** depois da região:

```text
/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>
```

Para a configuração própria de um serviço, o `<domínio>` é o nome do serviço, o `<recurso>` é `config` e o `<atributo>` é o nome da chave. Os templates dos generators e os exemplos já seguem essa forma: o serviço lê com um valor padrão no próprio `serverless.yml`.

```yaml
provider:
  environment:
    LOG_LEVEL: ${ssm:/playground/${sls:stage}/${aws:region}/example-ts/config/log-level, 'info'}
```

No Floci, para trocar o valor:

```bash
aws ssm put-parameter \
  --name /playground/local/us-east-1/example-ts/config/log-level \
  --type String --value debug --overwrite
```

O prefixo `/playground/<stage>/<região>/` e os três segmentos são os mesmos dos parâmetros que o bootstrap do Floci publica (por exemplo `/playground/local/us-east-1/backoffice/app/name`). Os recursos compartilhados que o bootstrap semeia, como a fila `shared/sample-events-queue`, estão na tabela [Parâmetros SSM publicados](../../infra/local/README.md#parâmetros-ssm-publicados) e no [guia do Floci](../onboarding/local-aws-floci.md#parâmetros-ssm-que-o-bootstrap-publica). Veja também a [convenção](../onboarding/local-aws-floci.md#convenção-dos-parâmetros-ssm).

### O contrato com o Terraform

A divisão de donos está no [ADR 0004](../adr/0004-serverless-e-terraform.md). Para quem escreve um `serverless.yml`, o que importa é:

- **Leia** o que o Terraform criou **só pelo SSM**, com `${ssm:/playground/${sls:stage}/${aws:region}/...}`. Não use `${terraform:outputs}` (não lê state local) nem leia o state do outro lado.
- **Publique** a URL da API e os ARNs que outras camadas precisam como `AWS::SSM::Parameter` em `resources`, para a camada edge do Terraform consumir. Os generators ainda **não** geram esse recurso: é **a implementar**.
- **Não declare** em `resources` o que o Terraform é dono: tabelas, buckets, user pools, filas compartilhadas, rede, IAM base, domínio, CloudFront, WAF.
- Cada serviço tem **uma** HTTP API própria. Um API Gateway único e compartilhado foi rejeitado, porque acopla os deploys de serviços diferentes.
- O `contract:check` (a implementar) é um target Nx que falha quando algum `${ssm:...}` de um `serverless.yml` não existe no catálogo de parâmetros publicado pelo Terraform.

Hoje o Terraform só existe para o ambiente local e publica no SSM do Floci o contrato da plataforma; os parâmetros que um serviço Lambda lê (fila, tabela, bucket) vêm do bootstrap do Floci ou do valor padrão do próprio `serverless.yml`. A ordem em que tudo é criado está no [guia de ordem de implantação](./ordem-de-implantacao.md).

## O que o `pre-deploy` valida

O executor `validate` roda antes de `package`, `deploy` e `remove` e falha com a lista de problemas:

| Regra                                                                                                                                                         | Vale para  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| O YAML é válido e declara `custom.nxServerless`.                                                                                                              | Todos      |
| Não usa `extends` (o Serverless v4 não aceita).                                                                                                               | Todos      |
| `provider.name` é `aws`; `service` existe e está em kebab-case.                                                                                               | Todos      |
| `custom.nxServerless.language` bate com a linguagem inferida.                                                                                                 | Todos      |
| O stage é um de `local`, `dev`, `homolog` ou `prod`, e é obrigatório em deploy, package e remove.                                                             | Todos      |
| `remove` em `prod` é recusado.                                                                                                                                | Todos      |
| O runtime começa com `nodejs`; existem `package.json` e `tsconfig.json`.                                                                                      | TypeScript |
| O runtime é `provided.al2023`; existe `go.mod`; `.bin/bootstrap.zip` existe em deploy e package (dispensado só se todas as funções usam imagem de container). | Go         |
| Há um `main.go` na raiz ou em `cmd/*/` (aviso, não erro).                                                                                                     | Go         |
| `custom.nxServerless.goPackage`, quando declarado, aponta para um pacote com `main.go`.                                                                       | Go         |
| O runtime é `java21` ou `provided.al2023` (resolvendo `${param:<nome>}` pelo stage); existe `build.gradle(.kts)`.                                             | Java       |

## Opções do plugin

Configuradas no `nx.json`, no bloco do plugin `./tools/serverless`. Este repositório usa só as duas primeiras:

| Opção                   | Padrão no código                                       | No `nx.json` deste repositório |
| ----------------------- | ------------------------------------------------------ | ------------------------------ |
| `defaultConfiguration`  | `floci`                                                | `floci`                        |
| `defaultGoArchitecture` | `arm64`                                                | `arm64`                        |
| `serverlessCommand`     | o `serverless` instalado, via `node` (sem `pnpm exec`) | (padrão)                       |
| `gradleCommand`         | `./gradlew`, rodado da raiz (serviços Java)            | (padrão)                       |
| `flociEndpoint`         | `http://localhost:4566`                                | (padrão)                       |
| `flociRegion`           | `us-east-1`                                            | (padrão)                       |

Também é possível renomear os targets (`validateTargetName`, `packageTargetName`, `deployTargetName`, `removeTargetName`, `invokeLocalTargetName`, `buildTargetName` e `testTargetName`).

Mais detalhes, inclusive dos executors `validate` e `go-build`, em [`tools/serverless/README.md`](../../tools/serverless/README.md).

## Problemas comuns

| Sintoma                                         | Causa provável                                              | O que fazer                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| O Serverless pede login                         | A v4 exige autenticação.                                    | `serverless login`, ou `SERVERLESS_ACCESS_KEY` no ambiente.                                    |
| `Não foi possível determinar a linguagem`       | A pasta tem `tsconfig.json` e `go.mod`, ou nenhum dos dois. | Declare `custom.nxServerless.language` no `serverless.yml`.                                    |
| `Artefato .bin/bootstrap.zip não encontrado`    | O binário Go não foi compilado.                             | `pnpm nx build <serviço>` (o `pre-deploy` já depende dele).                                    |
| `ECONNREFUSED` ou timeout para `localhost:4566` | O Floci não está no ar.                                     | `pnpm nx up infra-local` e `pnpm nx status infra-local`.                                       |
| `Stage "x" não permitido`                       | `--stage` fora de `local`, `dev`, `homolog`, `prod`.        | Use `-c floci`, `-c dev`, `-c homolog` ou `-c prod`; não repasse `--stage` à mão.              |
| `Remoção em "prod" bloqueada`                   | Proteção do plugin.                                         | Siga o runbook de descomissionamento.                                                          |
| `Deploy em prod bloqueado pelo plugin`          | Deploy em `prod` fora do pipeline.                          | Rode pelo pipeline (`CI=true`) ou, em emergência, exporte `NX_SERVERLESS_ALLOW_PROD_DEPLOY=1`. |
| Lambda Go falha ao iniciar no Floci             | Arquitetura do binário diferente da do host.                | Use a configuration `floci` no `build` (é o padrão ao fazer deploy local).                     |
| O serviço não aparece no Nx                     | O `serverless.yml` não declara `custom.nxServerless`.       | Acrescente o bloco (os generators já o criam).                                                 |
