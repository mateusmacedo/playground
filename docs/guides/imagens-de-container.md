# Guia: imagens de container

As imagens OCI dos serviços são o artefato de EC2, ECS e EKS ([ADR 0008](../adr/0008-adapters-de-runtime.md)): construídas **uma vez**, com a tag imutável `sha-<commit>`, e promovidas sem rebuild. A Lambda continua com o zip. Hoje existem imagens para `example-go` e `example-quarkus`; o TypeScript não tem imagem porque o entrypoint `main-http` ainda não existe.

## O que cada imagem é

| Serviço           | Runtime                                                                   | Usuário | Porta | `GET /health`   | Tamanho |
| ----------------- | ------------------------------------------------------------------------- | ------- | ----- | --------------- | ------- |
| `example-go`      | binário estático em `gcr.io/distroless/static-debian12:nonroot`           | `65532` | 8080  | `204` sem corpo | 11 MB   |
| `example-quarkus` | `fast-jar` em `eclipse-temurin:21-jre-noble` (modo `-Pruntime=container`) | `10001` | 8080  | `200` com JSON  | 307 MB  |

As bases são fixadas por digest (`tag@sha256:...`). Para atualizar, troque tag e digest juntos; o digest do índice multi-arquitetura vem de `docker buildx imagetools inspect <imagem:tag>`.

## Comandos

```bash
pnpm nx docker:build example-go          # playground/example-go:<tag>
pnpm nx docker:run example-go            # HOST_PORT muda a porta do host (padrão 8080)
pnpm nx docker:push-floci example-go     # constrói e publica no ECR do Floci (playground-example-go)
bash tools/container/image-tag.sh        # imprime a tag, para quem precisa dela fora do Nx
```

Os mesmos três targets existem em `example-quarkus`. Todos chamam `tools/container/image.sh`, que concentra o nome da imagem e o push; a tag vem de `tools/container/image-tag.sh`. O `docker:push-floci` depende do `docker:build`, roda sem cache e faz tudo sozinho: login no ECR do Floci, retag e push. Se o repositório não existe, ele para e manda rodar `pnpm nx apply infra-local-platform`.

## Decisões

- **Tag** (`tools/container/image-tag.sh`, a mesma para o build, o push e o Terraform): `sha-<7 caracteres do commit>` quando as entradas do build coincidem com o commit, e `sha-<7>-dirty-<12 hex do conteúdo>` quando não. O hash cobre o caminho e o conteúdo de `apps/services` (sem os `.md`), do Gradle da raiz, de `tools/java` e do `.dockerignore`; outras pastas não mexem na tag. O mesmo conteúdo dá a mesma tag, e conteúdo diferente nunca reaproveita uma tag já publicada. `IMAGE_TAG` no ambiente sobrescreve. O commit inteiro vai no rótulo `org.opencontainers.image.revision`.
- **Contexto de build**: a raiz do workspace, com o `.dockerignore` da raiz. O `@nx/docker` infere `docker:build` com a **pasta do projeto** como contexto e nomeia a imagem pelo caminho; por isso o `project.json` de cada serviço sobrescreve `docker:build` e `docker:run`, e zera o `dependsOn` (o `build` do Nx gera o zip de Lambda, que a imagem não usa).
- **Jar do Quarkus dentro da imagem**: o Gradle roda na etapa `build` do `Dockerfile`, com o cache do Gradle num cache mount. O `build` do Nx escreve o zip de Lambda na mesma pasta `build/`, e trocar o `runtime` ali sobrescreveria o artefato do deploy.
- **Heap do Quarkus**: `JAVA_OPTS` padrão `-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError`, pensado para uma EC2 micro de 1 GiB. Sobrescreva por ambiente, sem novo build. Medido: cerca de 100 MB de RSS e 2,3 s até responder, com 1 GiB e 1 CPU.

## Push no ECR do Floci

O repositório é do Terraform (`playground-<projeto>`, criado pelo `apply` do `infra-local-platform`); o script não cria repositório. Ele resolve o URI com `aws ecr describe-repositories`, faz `docker login` com `aws ecr get-login-password`, retagueia e publica.

- O script só fala com o Floci: recusa endpoint que não seja loopback (`AWS_ENDPOINT_URL`, padrão `http://localhost:4566`) e força as credenciais `test`.
- Em repositório `IMMUTABLE` (o caso dos repositórios atuais), o Floci recusa até o re-push do mesmo manifest; como a tag identifica o conteúdo, se ela já existe o script avisa e não publica.
- Os URIs saem como `000000000000.dkr.ecr.us-east-1.localhost:4566/<repositório>`. Um daemon com o containerd image store (padrão do Docker Engine 29 em instalações novas) só confia em `localhost` e `127.0.0.1` por HTTP; ali o Floci precisa de `floci.services.ecr.uri-style: path`. Este caminho, descrito na documentação do Floci, **não foi testado** aqui: o daemon do ambiente usa `overlay2`.

```bash
aws --endpoint-url http://localhost:4566 ecr list-images --repository-name playground-example-go
```

## Operação

- **ALB**: o `example-go` devolve `204` em `/health`; o matcher do target group deve aceitar `200-204`, porque o padrão do ALB é só `200`. Os probes do Kubernetes aceitam 200 a 399.
- **Rootfs somente leitura**: o Go sobe assim; o Quarkus precisa de `/tmp` gravável (`--tmpfs /tmp` no Docker, `emptyDir` no pod). Sem isso ele falha na partida.
- **SIGTERM**: o Go sai com código 0 e o Quarkus com 143 (convenção da JVM, 128 + 15), os dois em menos de 1 s e com o desligamento registrado no log.
- **Sem `HEALTHCHECK`** na imagem: o Go roda em distroless, sem shell nem `curl`. Quem checa a saúde é o orquestrador (ALB, ECS, probe).

## Fora do escopo hoje

- Imagem do executável nativo do Quarkus.
- Imagem `arm64` em execução: o Go constrói para `arm64` sem emulação (`docker buildx build --platform linux/arm64 --load`, imagem `arm64` de 10,6 MB confirmada), mas só a imagem `amd64` do host foi executada. O Quarkus só foi construído para o host.
- Publicação no GHCR e a tag semântica no release ([ADR 0010](../adr/0010-versionamento-e-publicacao-no-github.md)): o `@nx/docker` infere o target `nx-release-publish` nos dois projetos, que continuam fora dos grupos de imagem do `nx.json` (sem as tags `release:image` ou `publishable`).
