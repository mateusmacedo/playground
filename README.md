# Playground

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground)
[![Confiabilidade](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground)
[![Segurança](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=security_rating)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground)
[![Manutenibilidade](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground)
[![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=coverage)](https://sonarcloud.io/component_measures?id=mateusmacedo_playground&metric=coverage)
[![Duplicação](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=duplicated_lines_density)](https://sonarcloud.io/component_measures?id=mateusmacedo_playground&metric=duplicated_lines_density)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=bugs)](https://sonarcloud.io/project/issues?id=mateusmacedo_playground&types=BUG&resolved=false)
[![Vulnerabilidades](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=vulnerabilities)](https://sonarcloud.io/project/issues?id=mateusmacedo_playground&types=VULNERABILITY&resolved=false)
[![Code smells](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=code_smells)](https://sonarcloud.io/project/issues?id=mateusmacedo_playground&types=CODE_SMELL&resolved=false)

Monorepo [Nx](https://nx.dev) para um painel administrativo em Next.js e serviços serverless na AWS, com um ambiente AWS local virtualizado (Floci). Serve de base para crescer em várias stacks sem perder a mesma esteira de qualidade: um jeito de rodar, testar, cachear e publicar tudo.

## Visão geral

| Parte                                                                                     | Pasta                 | Situação                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Painel administrativo                                                                     | `apps/backoffice`     | **Existe.** Next.js 16 com o shell do CoreUI Free 5.x.                                     |
| E2E do painel                                                                             | `apps/backoffice-e2e` | **Existe.** Playwright.                                                                    |
| Ambiente AWS local                                                                        | `infra/local`         | **Existe.** Floci, o único ambiente AWS virtualizado.                                      |
| Plugin Nx de Serverless                                                                   | `tools/serverless`    | **Existe.** Targets, executors e generators para o Serverless Framework v4.                |
| Serviços de exemplo                                                                       | `apps/services`       | **Existe.** `example-ts`, `example-go` e `example-quarkus` (Java 21 com Quarkus e Gradle). |
| Terraform do ambiente local                                                               | `infra/terraform`     | **Existe.** 8 módulos e 2 envs (plataforma e serviços), provados no Floci.                 |
| NestJS, Angular, Go via `@nx-go/nx-go`, imagem de container do TypeScript e deploy na AWS | —                     | **Roadmap.** Ainda não existem.                                                            |

A visão completa, com diagramas, está em [`docs/architecture/overview.md`](./docs/architecture/overview.md).

## Direção da arquitetura

- **Tudo roda no Floci localmente**, inclusive a implantação do frontend como se fosse na AWS.
- **Backend serverless por preferência**, com **adapters de runtime**: o mesmo código-fonte vai para Lambda, ECS, EKS ou EC2 por opção de deploy ([ADR 0008](./docs/adr/0008-adapters-de-runtime.md)). O modelo é incremental: começa com poucos backends em EC2 e Lambdas, passa para ECS e depois para EKS.
- **Infraestrutura compartilhada** entre os manifestos Serverless (funções e eventos) e o Terraform (plataforma, dados e backends em container), com **um dono por recurso** e referência cruzada só pelo SSM ([ADR 0004](./docs/adr/0004-serverless-e-terraform.md) e [ADR 0009](./docs/adr/0009-camadas-e-ordem-de-implantacao.md)).

Hoje existem o Floci, o plugin Nx de Serverless, as Lambdas de exemplo, cujos templates já separam o núcleo do entrypoint (em Go, o mesmo binário sobe como Lambda ou como servidor HTTP), as imagens de container do `example-go` e do `example-quarkus` e o Terraform do ambiente local (L1 e L4), provado no Floci com `pnpm nx run infra-local:local:provision`. As demais camadas, a imagem do TypeScript e o deploy na AWS estão **a implementar**.

## Stack

| Camada              | Tecnologia                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orquestração        | Nx 24.0.0, conectado ao Nx Cloud (cache remoto e self-healing do CI)                                                                                                                                               |
| Pacotes             | pnpm 11.21.0 com workspaces e catálogo de versões (`catalog:`)                                                                                                                                                     |
| Linguagem e runtime | TypeScript 6.0 (setup TS solution) e Node 24                                                                                                                                                                       |
| Web                 | Next.js 16.4.6, React 19, CoreUI Free 5.x, Sass                                                                                                                                                                    |
| Testes              | Vitest 5 com jsdom e Testing Library; Playwright (e2e)                                                                                                                                                             |
| Qualidade           | Biome 2.6 (formata JS, TS, JSON, CSS, SCSS, YAML e Markdown, e linta JS, TS, JSON e CSS), Spotless (formata Java), gofmt (formata Go), ESLint mínimo (só as fronteiras do Nx), Lefthook (hooks do Git), commitlint |
| AWS local           | Floci 2.4.0 via Docker Compose, compatível com a API do LocalStack                                                                                                                                                 |
| Serverless          | Serverless Framework v4                                                                                                                                                                                            |
| Java                | Java 21, Quarkus 3.40.1.2, Gradle 9.7.0 (wrapper, multi-projeto na raiz) e Spotless 8.11.0; build nativo com Mandrel em container                                                                                  |
| CI e dependências   | GitHub Actions (actions fixadas por SHA, verificadas com actionlint) e Renovate                                                                                                                                    |

## Pré-requisitos

- **Node.js 24**.
- **pnpm 11**: a versão exata está em `packageManager` no `package.json`.
- **Docker** com Compose v2, para o ambiente AWS local.
- **AWS CLI v2**.
- **Serverless Framework v4**, com login (`serverless login` ou `SERVERLESS_ACCESS_KEY`), para fazer deploy de serviços.
- **Go 1.26 ou superior**, só para os serviços escritos em Go.
- **JDK 21**, só para os serviços Java: o Gradle vem pelo wrapper `./gradlew`, e o `@nx/gradle` roda o wrapper até para montar o grafo do Nx. O **build nativo** (stages `dev`, `homolog` e `prod`) exige também Docker.

Só Node e pnpm bastam para rodar o painel. O passo a passo, com verificações e problemas comuns, está em [`docs/onboarding/setup-local.md`](./docs/onboarding/setup-local.md).

## Início rápido

```bash
pnpm install
pnpm nx up infra-local        # opcional: sobe o Floci e provisiona os recursos iniciais
pnpm nx dev backoffice        # painel em http://localhost:3000
```

O ambiente AWS local fica em `http://localhost:4566`, com console web em `http://localhost:4566/_floci/ui`. Veja [`docs/onboarding/local-aws-floci.md`](./docs/onboarding/local-aws-floci.md).

## Estrutura de pastas

```text
.
├── apps/
│   ├── backoffice/          painel Next.js + CoreUI
│   ├── backoffice-e2e/      testes de ponta a ponta (Playwright)
│   └── services/            serviços serverless de exemplo (TypeScript, Go e Java)
├── infra/
│   ├── local/               Floci: ambiente AWS local (projeto Nx `infra-local`)
│   └── terraform/           Terraform do ambiente local: módulos e envs `platform` e `services`
├── packages/                libs compartilhadas (ainda vazio)
├── tools/
│   └── serverless/          plugin Nx de Serverless Framework
├── docs/                    documentação: ADRs, onboarding, guias, runbooks
├── .agents/                 rules, agents e skills de IA da raiz (cada projeto tem o seu)
├── .claude/                 symlinks para .agents/ e o settings.json do Claude Code
├── .github/                 CI (GitHub Actions) e configuração do Renovate
├── build.gradle             build Gradle da raiz (serviços Java), com settings.gradle e gradle.properties
├── nx.json                  plugins, namedInputs, targetDefaults e sync do Nx
├── pnpm-workspace.yaml      workspaces, catálogo de versões e allowBuilds
└── AGENTS.md                convenções e regras críticas
```

## Comandos do dia a dia

Todas as tarefas passam pelo Nx, com o prefixo `pnpm`:

```bash
pnpm nx show projects                       # projetos do workspace
pnpm nx show project backoffice --json      # targets de um projeto

pnpm nx dev backoffice                      # servidor de desenvolvimento
pnpm nx build backoffice                    # build de produção
pnpm nx lint backoffice                     # fronteiras do Nx (ESLint mínimo)
pnpm nx test backoffice                     # testes unitários

pnpm nx run-many -t lint test               # em todos os projetos
pnpm nx affected -t lint test typecheck build   # só no que mudou

pnpm nx sync:check                          # referências do TypeScript em dia?
pnpm nx graph                               # grafo de dependências
```

Atalhos da raiz (`package.json`), com o Biome cuidando da formatação:

```bash
pnpm format         # corrige a formatação (biome check --write .)
pnpm format:check   # só verifica (biome ci .)
pnpm lint           # Biome em tudo e as fronteiras do Nx (ESLint) em todos os projetos
pnpm check          # nível rápido: nx affected -t lint typecheck test (o mesmo do pre-push)
pnpm check:full     # nível completo: Biome e todos os projetos (inclui o spotlessCheck do Java), com coverage
pnpm e2e:full       # e2e em todos os browsers
```

### Serviços Java (Gradle)

```bash
pnpm nx test example-quarkus                 # testes (task do Gradle, via @nx/gradle)
pnpm nx spotlessCheck example-quarkus        # formatação do Java (corrige com spotlessApply)
pnpm nx build example-quarkus                # zip JVM, para o Floci
pnpm nx build example-quarkus -c prod        # zip nativo (precisa de Docker; leva cerca de 8 min)
./gradlew :example-quarkus:test              # o equivalente do test, direto no Gradle
./gradlew --stop                             # para o daemon do Gradle depois de um build nativo
```

O Spotless formata o Java e o `gofmt` formata o Go; o Biome não formata nenhum dos dois. Detalhes em [`docs/guides/servico-serverless.md`](./docs/guides/servico-serverless.md#serviço-java-quarkus).

Mais em [`docs/guides/nx-tarefas.md`](./docs/guides/nx-tarefas.md).

### Ambiente AWS local

```bash
pnpm nx up infra-local         # sobe e provisiona (idempotente)
pnpm nx status infra-local     # containers e saúde do Floci
pnpm nx logs infra-local       # logs
pnpm nx down infra-local       # derruba, mantendo os dados
pnpm nx reset infra-local      # apaga os dados e recria
pnpm nx validate infra-local   # valida a configuração, sem subir containers
```

## Testes

```bash
pnpm nx test backoffice                              # Vitest (unitários)
pnpm exec playwright install chromium                # uma vez
pnpm nx e2e backoffice-e2e                           # Playwright (e2e), só Chromium por padrão
pnpm e2e:full                                        # Chromium, Firefox e WebKit
```

O e2e sobe o painel sozinho e reaproveita um servidor já aberto na porta 3000. No PR o CI roda só o Chromium; o workflow de release roda os três browsers.

## Convenções

- **Branch**: `tipo/descricao-curta`, com `tipo` em `feat`, `fix`, `refactor`, `perf`, `docs`, `test` ou `chore`. Exemplo: `feat/customers-page`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) **em inglês**, no imperativo e em minúsculas: `feat(backoffice): add customers page`. O `scope` é o nome de um projeto Nx ou um de `workspace`, `ci`, `deps`, `release`, `docs`, `tooling`, `infra`. O hook `commit-msg` (commitlint) valida.
- **Pull requests**: sempre para a **`main`**.
- **Idioma**: documentação em PT-BR; código, identificadores e commits em inglês.
- **Hooks do Git** (Lefthook, instalados no `pnpm install`): `pre-commit` formata e corrige com o Biome os arquivos do commit e roda `gofmt -w` nos `*.go` do commit (Java não entra: o Spotless leva 22 a 26 s com a JVM fria), `commit-msg` roda o commitlint e `pre-push` roda `nx affected -t lint typecheck test`. Não use `--no-verify`.
- **Segredos**: nunca em `NEXT_PUBLIC_*` (vão para o navegador) nem em arquivos versionados. `.env` é ignorado pelo git.

O detalhe completo, inclusive as regras para agentes de IA, está em [`AGENTS.md`](./AGENTS.md). As instruções de IA são organizadas por escopo: cada projeto tem o seu `AGENTS.md` (com um `CLAUDE.md` que o importa) e o seu `.agents/` com rules e skills, que o Claude Code lê por symlinks em `.claude/`. A estrutura e o índice estão em [`.agents/README.md`](./.agents/README.md).

## CI

A política é **rápida por padrão, completa só no release**.

O `.github/workflows/ci.yml` roda em pull requests e em push na `main`, cancela execuções antigas da mesma branch e tem três jobs:

1. **Format**: `biome ci` (no PR só nos arquivos alterados em relação à `origin/main`; no push para a `main`, no repositório inteiro) e `gofmt -l` nos `*.go`, que falha se listar algum arquivo.
2. **Checks**: `nx sync:check` e `nx affected -t lint typecheck test build`, com as SHAs de base e head do `nx-set-shas`, e o self-healing do Nx Cloud (`nx fix-ci`).
3. **E2E**: só roda se algum projeto de e2e foi afetado, e então executa `nx affected -t e2e` no Chromium.

O `.github/workflows/release.yml` é o nível completo e o único que versiona e publica. Dispara **só manualmente** (`workflow_dispatch`, com a opção `dry-run`), valida **todos** os projetos (coverage nos testes e e2e em Chromium, Firefox e WebKit) e, se tudo passar, roda o `nx release`: versão pelos Conventional Commits, changelog por projeto, tag `{projeto}@{versão}`, GitHub Release por projeto e, quando houver libs npm (GitHub Packages) ou imagens (GHCR), a publicação. Hoje só os serviços serverless entram no release e nenhum grupo publica em registry. O release de verdade só roda a partir da `main`; o `dry-run` vale em qualquer branch e não altera nada. Detalhes no [guia de release](./docs/guides/release.md) e no [ADR 0010](./docs/adr/0010-versionamento-e-publicacao-no-github.md).

Todos usam a action local `.github/actions/setup` (pnpm, Node 24 e `pnpm install --frozen-lockfile`). Os jobs que chamam o `nx` pedem também o JDK 21 (`java-version`, Temurin com cache do Gradle), porque o `@nx/gradle` roda o `./gradlew` para montar o grafo; os jobs `format` e `actionlint` não instalam Java. O `format` e o `checks` também instalam o Go da versão do `apps/services/example-go/go.mod` (`go-version-file`, `actions/setup-go` com cache de `**/go.sum`). O `spotlessCheck` do Java fica **só no nível completo** (`release.yml` e `pnpm check:full`); no PR, o `build` do `example-quarkus-core` já roda o `check` do Gradle, que inclui o Spotless e os testes. O Renovate agrupa `nx`, `github-actions`, `quarkus`, `gradle-wrapper` e `aws-lambda-go`, e roda `go mod tidy` depois de atualizar um módulo Go.

As actions são **fixadas por SHA**, e o workflow `actionlint` (em PRs que mudam `.github/**`, `renovate.json` ou `tools/lint-actions.sh`) verifica a sintaxe, a política de pinning e o `renovate.json`. O Renovate mantém as dependências e as SHAs em dia; as atualizações do Nx saem agrupadas e sem automerge, porque exigem `pnpm nx migrate`.

Para rodar a mesma verificação de workflows localmente (o script baixa o actionlint na versão fixada em `.github/actionlint.versions`, então precisa de rede):

```bash
bash tools/lint-actions.sh          # actionlint, pinning e renovate.json
bash tools/lint-actions.sh --help   # modos disponíveis
```

## Nx Cloud

O workspace está conectado ao Nx Cloud (`nxCloudId` no `nx.json`): o cache das tarefas é compartilhado entre máquinas e CI, e o self-healing do CI sugere correções para falhas. O cache local fica em `.nx/cache`; `pnpm nx reset` o limpa.

## Documentação

| Assunto                       | Onde                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Índice                        | [`docs/README.md`](./docs/README.md)                                               |
| Setup local                   | [`docs/onboarding/setup-local.md`](./docs/onboarding/setup-local.md)               |
| Floci (AWS local)             | [`docs/onboarding/local-aws-floci.md`](./docs/onboarding/local-aws-floci.md)       |
| Arquitetura                   | [`docs/architecture/overview.md`](./docs/architecture/overview.md)                 |
| Decisões (ADRs)               | [`docs/adr/README.md`](./docs/adr/README.md)                                       |
| Nova página no backoffice     | [`docs/guides/backoffice-nova-pagina.md`](./docs/guides/backoffice-nova-pagina.md) |
| Serviço serverless            | [`docs/guides/servico-serverless.md`](./docs/guides/servico-serverless.md)         |
| Tarefas do Nx                 | [`docs/guides/nx-tarefas.md`](./docs/guides/nx-tarefas.md)                         |
| Desempenho e recursos         | [`docs/guides/desempenho-e-recursos.md`](./docs/guides/desempenho-e-recursos.md)   |
| Ordem de implantação          | [`docs/guides/ordem-de-implantacao.md`](./docs/guides/ordem-de-implantacao.md)     |
| Release                       | [`docs/guides/release.md`](./docs/guides/release.md)                               |
| Runbooks                      | [`docs/runbooks/TEMPLATE.md`](./docs/runbooks/TEMPLATE.md)                         |
| Painel (estrutura e extensão) | [`apps/backoffice/README.md`](./apps/backoffice/README.md)                         |
