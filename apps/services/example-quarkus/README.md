# example-quarkus

Serviço serverless em Java 21 com Quarkus, HTTP acionado pelo API Gateway
(HTTP API). O build é Gradle, a partir da raiz do repositório (`./gradlew`).

## Estrutura

- `core/`: projeto Gradle `:example-quarkus-core`, com o domínio e os casos de
  uso em Java puro. Sem Quarkus no classpath, o compilador barra qualquer
  dependência do núcleo no runtime.
- `src/`: projeto Gradle `:example-quarkus`, a aplicação Quarkus. O recurso
  JAX-RS `HelloResource` traduz a requisição e chama o caso de uso;
  `UseCases` entrega os casos de uso do núcleo ao CDI.

São dois projetos, e não três (domínio, aplicação e serviço, como em
monorepos maiores), porque um exemplo deste tamanho não tem casos de uso que
justifiquem um módulo próprio. O que importa é a fronteira entre o núcleo e o
runtime, e ela é garantida pelo classpath. A aplicação fica na mesma pasta do
`serverless.yml` para os targets do Gradle e os do plugin serverless caírem no
mesmo projeto do Nx, `example-quarkus`.

## Lock de dependências

Os dois projetos travam as versões resolvidas no `gradle.lockfile` de cada
pasta (dependency locking do Gradle, ligado no `build.gradle` da raiz). O build
falha se uma dependência resolvida não bater com o lock. Depois de acrescentar
ou atualizar uma dependência, regenere os locks e inclua os arquivos no PR:

```bash
./gradlew resolveAndLockAll --write-locks
```

O JaCoCo e o `quarkus-jacoco` estão sempre no grafo, desligados sem
`-Pcoverage`, para o lock ser o mesmo com e sem cobertura.

## Adapter de runtime

O mesmo código JAX-RS roda como Lambda ou como servidor HTTP. A escolha é no
**build**, pela propriedade Gradle `runtime`:

| `-Pruntime=`        | Extensão                     | Artefato                            |
| ------------------- | ---------------------------- | ----------------------------------- |
| `lambda` (o padrão) | `quarkus-amazon-lambda-http` | `build/function.zip`                |
| `container`         | nenhuma                      | `build/quarkus-app/quarkus-run.jar` |

Diferente dos exemplos TypeScript e Go, a detecção não é feita na partida
pela variável `AWS_LAMBDA_RUNTIME_API`: a extensão de Lambda troca, no build,
o servidor HTTP pelo loop de eventos da Lambda, então o artefato de Lambda só
roda dentro dela.

## Modo container

```bash
./gradlew :example-quarkus:quarkusBuild -Pruntime=container
PORT=8080 java -jar apps/services/example-quarkus/build/quarkus-app/quarkus-run.jar
curl -i localhost:8080/health
curl localhost:8080/example-quarkus
```

O health vem do `quarkus-smallrye-health` em `/health` (com `/health/live` e
`/health/ready`), o log sai em JSON no stdout e o `SIGTERM` espera até 10 s
pelas requisições em andamento.

## Imagem de container

O `Dockerfile` gera a imagem JVM para EC2, ECS e EKS: `eclipse-temurin:21-jre-noble`
(base fixada por digest), `fast-jar` do Quarkus, usuário `10001` e porta `8080`.
O contexto de build é a raiz do workspace.

O jar sai de um `./gradlew :example-quarkus:quarkusBuild -Pruntime=container`
dentro da própria imagem (etapa `build`, com o cache do Gradle num cache mount),
e não do `build` do Nx: o `build` gera o zip de Lambda na mesma pasta `build/`, e
trocar o `runtime` ali sobrescreveria o artefato do deploy. Os testes continuam
no Nx.

A JVM sobe com `JAVA_OPTS` (`-XX:MaxRAMPercentage=60 -XX:+UseSerialGC
-XX:+ExitOnOutOfMemoryError`), pensado para uma EC2 micro de 1 GiB. A variável
é sobrescrevível por ambiente (task do ECS, env do pod), sem novo build.

```bash
pnpm nx docker:build example-quarkus         # playground/example-quarkus:<tag>
pnpm nx docker:run example-quarkus           # HOST_PORT muda a porta do host
pnpm nx docker:push-floci example-quarkus    # constrói e publica no ECR do Floci (playground-example-quarkus)
pnpm nx apply infra-local-services           # deploy do container (Terraform), depois do push
```

O `docker:push-floci` depende do `docker:build`, não usa cache e faz o login, o
retag e o push sozinho; o repositório vem do `pnpm nx apply infra-local-platform`.
O deploy do container é o `apply` do `infra-local-services`, que depende do
`docker:push-floci` dos serviços. A tag (`sha-<commit>` ou
`sha-<commit>-dirty-<hash>`) vem de `tools/container/image-tag.sh`; os detalhes
estão em
[`docs/guides/imagens-de-container.md`](../../../docs/guides/imagens-de-container.md).
A imagem do executável nativo não existe: o nativo hoje só sai como zip de
Lambda.

## Build nativo

```bash
./gradlew :example-quarkus:quarkusBuild \
  -Dquarkus.native.enabled=true -Dquarkus.package.jar.enabled=false
```

No Gradle, o Quarkus não gera o jar e o nativo na mesma execução; sem o
`jar.enabled=false`, o build falha.

O executável é gerado pelo Mandrel em container (Docker), já com o nome
`bootstrap` dentro do `build/function.zip`, para o runtime `provided.al2023`.
O `native-image` não faz cross-compile: o binário tem a arquitetura da máquina
do build, por isso o `provider.architecture` padrão é `x86_64`. Para `arm64`,
gere o build num runner arm64 e passe `SLS_ARCH=arm64`.

A memória do build é limitada no `application.properties`
(`quarkus.native.native-image-xmx=2g` e `--memory=3g` no container). Sem o
teto, o `native-image` se dimensiona pela RAM da máquina. Numa máquina de 8
CPUs, o build levou cerca de 8 min (6 min no `native-image`), com pico de
2,7 GB no builder e 1,6 GB no Gradle.

## Runtime por stage

O `serverless.yml` escolhe o runtime pelo parâmetro `lambdaRuntime`: `java21`
(zip JVM) no stage `local`, do Floci, e `provided.al2023` (zip nativo) nos
demais. Para publicar o nativo no Floci, gere o build nativo e passe
`--param="lambdaRuntime=provided.al2023"` ao Serverless.

## Comandos

```bash
pnpm nx run-many -t test -p example-quarkus example-quarkus-core
pnpm nx run-many -t spotlessCheck -p example-quarkus example-quarkus-core
pnpm nx build example-quarkus                  # zip JVM, para o Floci
pnpm nx build example-quarkus -c prod          # zip nativo
pnpm nx run example-quarkus:deploy             # Floci (configuration padrão)
pnpm nx run example-quarkus:remove             # Floci
```

Os projetos `example-quarkus` e `example-quarkus-core` e as tasks do Gradle
(`test`, `spotlessCheck`, `spotlessApply`, `quarkusDev` e as demais) chegam ao
Nx pelo `@nx/gradle`. O `build`, o `deploy` e os outros targets do Serverless
vêm do plugin local `tools/serverless`; o `build` executa o `quarkusBuild` do
Gradle. Fora do Nx, o equivalente é `./gradlew :example-quarkus:test`.

No Floci, a HTTP API responde em
`http://localhost:4566/_aws/execute-api/<apiId>/$default/example-quarkus`.

## Parâmetros

Os parâmetros por ambiente vêm do SSM, no caminho
`/playground/<stage>/<região>/example-quarkus/<recurso>/<atributo>`, com valor
padrão no próprio `serverless.yml`. Hoje há só
`/playground/<stage>/<região>/example-quarkus/config/log-level`, lido como
`LOG_LEVEL` e aplicado em `quarkus.log.level`.

O log JSON usa `quarkus.log.console.json.key-overrides=timestamp=time` para
seguir o formato mínimo dos outros serviços. O Quarkus só renomeia a chave: o
valor do nível sai em maiúsculas, e o id da invocação da Lambda fica em
`mdc.AWSRequestId`, e não em `requestId`.
