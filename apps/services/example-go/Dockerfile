# Imagem do modo container do example-go (ECS, EKS ou EC2). O contexto é a raiz
# do workspace: `pnpm nx docker:build example-go`.
# NOTE: sem `# syntax=`: o frontend do BuildKit do Docker 29 já cobre
# `--mount=type=cache`, e a diretiva puxaria uma imagem sem digest a cada build.

FROM --platform=$BUILDPLATFORM golang:1.26-alpine@sha256:30b1e546a9c7fa3b747c2bdba3a0c7bdf3a02ebb4c5b8405d2f948d7e8aac4ec AS build

ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

# WHY: go.mod e go.sum antes do código; o download das dependências só refaz
# quando elas mudam.
COPY apps/services/example-go/go.mod apps/services/example-go/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY apps/services/example-go/cmd ./cmd
COPY apps/services/example-go/internal ./internal

# WHY: sem a tag lambda.norpc e sem AWS_LAMBDA_RUNTIME_API, o binário sobe o
# net/http na PORT (ADR 0008). CGO desligado gera binário estático, que roda no
# distroless sem libc. GOARCH vem do alvo do build: a arquitetura do host, a
# menos que o build peça outra plataforma.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS="${TARGETOS}" GOARCH="${TARGETARCH}" \
    go build -trimpath -buildvcs=false -ldflags "-s -w" \
      -o /out/example-go ./cmd/example-go

FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab

# NOTE: o ARG fica no fim para trocar o commit não invalidar o cache do build.
ARG REVISION=desconhecida
LABEL org.opencontainers.image.title="example-go" \
      org.opencontainers.image.revision="${REVISION}"

COPY --from=build /out/example-go /example-go

USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/example-go"]
