# Playground: instruções para agentes

Monorepo **Nx 24 + pnpm 11** (setup TypeScript solution, Node 24). Hoje contém o painel `apps/backoffice` (Next.js 16 com CoreUI), o e2e `apps/backoffice-e2e`, o ambiente AWS local `infra/local` (Floci), o plugin Nx `tools/serverless` e três serviços serverless de exemplo em `apps/services` (TypeScript, Go e Java com Quarkus). O mapa completo está em [`docs/README.md`](./docs/README.md).

Este arquivo é a fonte de verdade das convenções **gerais** do repositório. Precedência quando as instruções divergem: o arquivo mais específico vence o geral (por exemplo, o [`AGENTS.md`](./apps/backoffice/AGENTS.md) do backoffice, sobre o Next.js), e os arquivos de configuração executável (`package.json`, `nx.json`, `pnpm-workspace.yaml`, `lefthook.yml`, `commitlint.config.mjs`, `.github/workflows/ci.yml`) prevalecem sobre a prosa.

## Meta

### Idioma

- **Responda ao usuário sempre em português (PT-BR)**, com acentuação correta.
- **Documentação** (`README.md`, `docs/`, ADRs, runbooks) em PT-BR.
- **Código-fonte** em inglês: variáveis, funções, tipos, nomes de arquivos de código e **mensagens de commit**. Texto exibido ao usuário final do painel é PT-BR.

### Níveis das regras

| Nível           | Significado                                    | Exemplo                                     |
| --------------- | ---------------------------------------------- | ------------------------------------------- |
| **OBRIGATÓRIO** | Quebra o build, o CI ou a segurança se violado | Validar antes de dar a tarefa por concluída |
| **RECOMENDADO** | Padrão esperado do repositório                 | Convenções de código e de nomes             |
| **OPCIONAL**    | Melhoria incremental                           | Remover código morto encontrado de passagem |

Uma regra sem nível é **RECOMENDADO**.

### Precedência e escopo

- Faça o que foi pedido, nos arquivos pedidos. Melhorias encontradas pelo caminho são **reportadas**, não incluídas.
- Na dúvida entre agir e perguntar, pergunte. Na dúvida entre supor e verificar, verifique: leia o arquivo, rode `--help`, consulte `pnpm nx show project <nome> --json`.
- O bloco `nx configuration` no fim deste arquivo é gerenciado pelo Nx: **não edite**. Tudo que for do repositório fica **acima** dele.

## Convenções do monorepo

### Ferramentas

- **pnpm 11** para tudo (a versão exata está em `packageManager`). Não use `npm` nem `yarn`.
- Tarefas sempre **pelo Nx**, prefixadas com o gerenciador: `pnpm nx build backoffice`, `pnpm nx affected -t test`. Não chame `next`, `vitest` ou `eslint` direto.
- Versões de dependências ficam no catálogo do pnpm (`catalog:` em `pnpm-workspace.yaml`). Dependência nova entra no catálogo e é referenciada com `catalog:` nos `package.json`.
- Projeto ou lib nova nasce de um gerador do Nx (skill `nx-generate`), não de cópia de pasta. Libs se ligam por dependência de workspace do pnpm, não por `paths` no `tsconfig`.
- Nunca edite `pnpm-lock.yaml` à mão: rode `pnpm install`.

### Estrutura

```text
apps/
  backoffice/       painel Next.js + CoreUI
  backoffice-e2e/   Playwright
  services/         serviços serverless (example-ts, example-go, example-quarkus)
infra/
  local/            Floci (ambiente AWS local), projeto Nx `infra-local`
packages/           libs compartilhadas
tools/
  serverless/       plugin Nx de Serverless Framework, projeto `nx-serverless`
  java/             perfil do formatador Java (eclipse-formatter.xml, usado pelo Spotless)
  release/          ações de versão do `nx release` (versão por tag git)
build.gradle        build Gradle da raiz (com settings.gradle, gradle.properties e o wrapper gradlew)
docs/               documentação (ADRs, onboarding, guias, runbooks)
.agents/            assets de IA da raiz (rules, agents, skills); cada escopo tem o seu
.claude/            symlinks para .agents/ (e o settings.json do plugin do Nx)
```

A seção "Estrutura de pastas" do [`README.md`](./README.md) tem o quadro atualizado, inclusive o que ainda está em construção.

### Git

- **Branch** `tipo/descricao-curta`, com `tipo` em `feat`, `fix`, `refactor`, `perf`, `docs`, `test` ou `chore`, e descrição em kebab-case minúsculo. Exemplo: `feat/customers-page`.
- **PR sempre para a `main`.** Não existe `develop` como base. O merge é só por rebase (histórico linear, data de autoria preservada), e o ruleset da `main` exige os checks do CI e o gate do SonarQube ([ADR 0015](./docs/adr/0015-metas-de-qualidade-e-gate-obrigatorio.md)).
- **Commits** em Conventional Commits, em **inglês**: `tipo(scope): descrição`, no imperativo, minúscula, só ASCII, até 120 caracteres, sem ponto final. O `scope` é o nome de um projeto Nx ou um destes: `workspace`, `ci`, `deps`, `release`, `docs`, `tooling`, `infra`. Os projetos da raiz (`@org/source` do pnpm e `playground` do Gradle) **não** valem como scope: use `workspace`. O `commitlint.config.mjs` valida isso no hook `commit-msg`.
- O `.gitattributes` fixa o fim de linha em **LF** (CRLF só em `*.bat`; o `gradlew` em LF; `*.jar` e `*.zip` como binários). O `.editorconfig` segue o mesmo critério.
- Nunca use `--no-verify` para contornar hook. Se um hook falhar, corrija a causa.
- Não faça commit, push nem force push sem pedido explícito do usuário.

### Código

- **TypeScript estrito** (`strict` no `tsconfig.base.json`). Evite `any`.
- **Biome** (`biome.json`) formata JS, TS, JSON, CSS, SCSS, YAML e Markdown e linta JS, TS, JSON e CSS (domínios `next`, `react`, `test` e `playwright`; `noImportCycles` como erro). Estilo: aspas simples, 2 espaços, 80 colunas, ponto e vírgula e vírgula final. Formate com `pnpm format`; o `pre-commit` faz o mesmo nos arquivos do commit. O **ESLint é mínimo**: só `@nx/enforce-module-boundaries`. Regra de lint de TypeScript, React, Next ou Playwright é do Biome. Não existe Prettier nem `nx format` ([ADR 0007](./docs/adr/0007-lint-e-formatacao-biome-eslint-minimo.md)). O Java é formatado pelo Spotless ([`example-quarkus`](./apps/services/example-quarkus/AGENTS.md)) e o Go pelo `gofmt` (rule `services-go` de `apps/services`). `.agents/` e `.claude/`, em qualquer nível, ficam **fora** da formatação, porque o formatador de Markdown do Biome estraga o frontmatter das rules, dos agents e das skills.
- Comentário explica o **porquê**, nunca o quê. Use os marcadores `WHY:` e `NOTE:` como o código existente faz. Nada de comentário que repete o código, banner decorativo ou código comentado.
- Testes `*.spec.ts` ficam ao lado do código; e2e em `apps/backoffice-e2e/src`.

### Tags do Nx

Cada projeto declara tags, como `scope:backoffice` e `type:app` no painel, `scope:infra` e `type:tool` no `infra-local`, e `type:app`, `stack:ts`, `stack:go` ou `stack:java` e `platform:serverless` nos serviços. Use as tags existentes antes de inventar outras.

### Instruções de IA

As instruções são organizadas por escopo ([ADR 0012](./docs/adr/0012-instrucoes-de-ia-por-projeto.md); detalhes em [`.agents/README.md`](./.agents/README.md)). Cada escopo tem um `AGENTS.md` (fonte única do contexto dele) e um `CLAUDE.md` irmão que só contém `@AGENTS.md`, porque o Claude Code lê só o `CLAUDE.md` quando ele existe. As rules e skills do escopo ficam em `<escopo>/.agents/` e chegam ao Claude Code por symlinks relativos em `<escopo>/.claude/`. O `AGENTS.md`, as rules e as skills de um projeto carregam sob demanda, quando o agente lê um arquivo daquela pasta.

| Escopo                                                                                                      | Cobre                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/backoffice`](./apps/backoffice/AGENTS.md)                                                            | Next.js 16 (rule `nextjs-16`, MCP `next-devtools`), código, estrutura, autorização e testes do painel; skills de React                              |
| [`apps/backoffice-e2e`](./apps/backoffice-e2e/AGENTS.md)                                                    | Playwright e o servidor do e2e                                                                                                                      |
| [`apps/services`](./apps/services/AGENTS.md)                                                                | Todo serviço: serviço novo, `serverless.yml`, núcleo e entrypoints, performance; rules de Go, TypeScript e erros; skills de Go, DDD, erros e NestJS |
| [`example-ts`](./apps/services/example-ts/AGENTS.md) e [`example-go`](./apps/services/example-go/AGENTS.md) | O que é só de cada serviço                                                                                                                          |
| [`example-quarkus`](./apps/services/example-quarkus/AGENTS.md)                                              | Java, Quarkus, Gradle (inclusive os arquivos Gradle da raiz) e Spotless; vale também para o `core/`                                                 |
| [`tools/serverless`](./tools/serverless/AGENTS.md)                                                          | O plugin `nx-serverless`                                                                                                                            |
| [`infra/local`](./infra/local/AGENTS.md)                                                                    | O Floci local                                                                                                                                       |
| [`infra/terraform`](./infra/terraform/AGENTS.md)                                                            | O Terraform local: módulos, envs `platform` e `services`, `TF_DATA_DIR` e gatilhos de evolução                                                      |

- Na raiz ficam só os assets transversais: as rules de `.agents/rules/`, as skills de arquitetura e de código e os agentes `architecture`, `change-impact-analysis` e `security` (somente leitura). Agente fica **só na raiz**, porque o Claude Code não descobre `.claude/agents` em subpasta. Revisão, depuração, testes e performance usam os agentes do plugin global. As skills do Nx são geradas: não as edite.
- **OBRIGATÓRIO**: cada instrução vive num único lugar, o escopo mais específico que a cobre; um projeto não repete o que está aqui. Nomes de skill (`skill-<domínio>-<tema>`) e de agente são únicos em todos os escopos e diferentes dos do usuário e dos plugins. O `node tools/ai/check-instructions.mjs`, que roda no `pnpm lint`, confere. Para criar skill, rule ou escopo novo, siga o [`.agents/README.md`](./.agents/README.md).

## Comandos de validação

Tudo pela raiz do repositório:

| O quê                       | Comando                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Lint                        | `pnpm lint` (Biome em tudo e as fronteiras do Nx via ESLint); só as fronteiras no afetado: `pnpm nx affected -t lint` |
| Testes unitários            | `pnpm nx run-many -t test` (afetados: `pnpm nx affected -t test`)                                                     |
| Typecheck e build           | `pnpm nx affected -t typecheck build`                                                                                 |
| Formatação                  | `pnpm format:check` (corrige com `pnpm format`)                                                                       |
| Referências do TypeScript   | `pnpm nx sync:check` (corrige com `pnpm nx sync`)                                                                     |
| E2E                         | `pnpm nx e2e backoffice-e2e` (Chromium por padrão; todos os browsers com `pnpm e2e:full`)                             |
| Atalho rápido               | `pnpm check` (`nx affected -t lint typecheck test`, o mesmo do `pre-push`)                                            |
| Atalho completo             | `pnpm check:full` (Biome e todos os projetos, com coverage e `spotlessCheck` do Java)                                 |
| Workflows do GitHub Actions | `bash tools/lint-actions.sh` (actionlint, pinning por SHA e `renovate.json`)                                          |
| Ambiente local (Floci)      | `pnpm nx validate infra-local`                                                                                        |

**OBRIGATÓRIO** ao terminar qualquer tarefa que altere código: rodar lint, testes e build/typecheck dos projetos afetados (`pnpm nx affected -t lint test typecheck build`, ou `pnpm check` para o nível rápido), `pnpm format:check` e, se mexeu em Java, o `spotlessCheck` dos projetos Java e, se falhar por causa da sua alteração, corrigir e repetir. Falha que já existia antes da alteração é reportada, não corrigida em silêncio.

A política é **rápida por padrão, completa só no release**. O `ci.yml` (PR e push na `main`) roda `biome ci` (só nos arquivos alterados, no PR), `nx sync:check`, `nx affected -t lint typecheck test build` e o e2e no Chromium quando algum projeto de e2e foi afetado. O `release.yml` (só disparo manual, com a opção `dry-run`) roda tudo, com coverage e e2e em todos os browsers, e depois o `nx release`, que versiona, gera changelog, tagueia e cria as GitHub Releases dos serviços; nenhum grupo publica em registry ainda ([guia](./docs/guides/release.md)). O hook `pre-push` roda `nx affected -t lint typecheck test`. O `test` dos projetos Go e Java entra no `affected`: o `^build` do `targetDefaults.test` vale só para os testes do `@nx/vitest`. O `spotlessCheck`, que só existe nos projetos Java, fica só no nível completo. Rode o equivalente antes de abrir o PR. Os comandos próprios de Java, Go, e2e e Floci estão no `AGENTS.md` ou nas rules de cada escopo.

## Regras críticas

### Ambiente local

- **OBRIGATÓRIO**: o **Floci é o único ambiente AWS virtualizado** do repositório. Não introduza outro emulador (LocalStack, moto, DynamoDB Local, SAM local) nem Docker Compose paralelo para serviços AWS. Endpoint `http://localhost:4566`, credenciais fictícias.
- **OBRIGATÓRIO**: configuração de stage `local` nunca aponta para uma conta AWS real, e credenciais reais nunca entram em arquivo versionado.
- Parâmetros SSM seguem o caminho canônico `/playground/local/us-east-1/<dominio>/<recurso>/<atributo>`. O que o Floci provisiona no bootstrap é a referência do que existe no ambiente local.

### Serviços serverless

- **OBRIGATÓRIO**: deploy só no Floci (configuration `floci`, o padrão) a menos que o usuário peça explicitamente `-c dev`, `-c homolog` ou `-c prod`. Ainda não existe conta AWS nem pipeline de deploy dos serviços.
- O plugin bloqueia `remove` em `prod`. Não contorne a proteção.

### CI e dependências

- **OBRIGATÓRIO**: toda action do GitHub Actions é **fixada pelo SHA do commit** (com o comentário `# vX.Y.Z`), nunca por tag. `bash tools/lint-actions.sh --check-pinning` confere; o Renovate mantém os SHAs.
- Passos repetidos entre jobs vão para uma action local em `.github/actions/` (hoje, `setup`: pnpm, Node, instalação e, opcionalmente, o JDK Temurin com cache do Gradle via `java-version` (`actions/setup-java`) e o Go do `go.mod` via `go-version-file` (`actions/setup-go`, com cache de `**/go.sum`), ambos fixados por SHA). Os jobs que chamam `nx` (`checks` e `e2e` do `ci.yml`; `checks`, `e2e` e `release` do `release.yml`) instalam o JDK 21, porque o `@nx/gradle` roda o `./gradlew` para montar o grafo do Nx. Os jobs `format` e `checks` (nos dois workflows) e o `release` (no `release.yml`) instalam também o Go do `apps/services/example-go/go.mod`: o `format` roda o `gofmt` e os demais precisam do Go para os projetos Go. Os jobs `format` e `actionlint` não instalam Java.
- Atualizações do Nx exigem `pnpm nx migrate` depois do merge; por isso o Renovate não faz automerge delas. O Renovate agrupa também `quarkus` (`io.quarkus**` e `io.quarkus.platform**`), `gradle-wrapper` e `aws-lambda-go` (a lib e o api-proxy), e roda `go mod tidy` depois de atualizar um módulo Go (`gomodTidy`).

### Segredos e configuração

- **OBRIGATÓRIO**: `.env` é ignorado pelo git. Só os `.env.example` são versionados, e sem valores reais.
- Segredos e configuração do painel (`NEXT_PUBLIC_*`, `app-config.ts`): [`apps/backoffice/AGENTS.md`](./apps/backoffice/AGENTS.md).

### Arquitetura e infraestrutura

- **OBRIGATÓRIO**: **um único dono por recurso** (Terraform ou Serverless), decidido pela regra em ordem do [ADR 0004](./docs/adr/0004-serverless-e-terraform.md): dado que sobrevive ao código, recurso de 2 ou mais serviços, fundação de rede, segurança ou identidade e backend em container são do **Terraform**; o que pertence 1:1 a uma Lambda e pode morrer com ela é do **Serverless**.
- **OBRIGATÓRIO**: referência entre os dois lados **só pelo SSM** canônico (`/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`). Não use `${terraform:outputs}`, `terraform_remote_state` nem leia o state do outro lado.
- Núcleo puro, entrypoints por runtime e contrato de execução de um serviço: [`apps/services/AGENTS.md`](./apps/services/AGENTS.md).
- Camadas L0 a L6. **A dependência só aponta para baixo**: uma camada usa as de número menor (L5 usa L4, nunca o contrário), sempre via SSM canônico, sem `terraform_remote_state` nem entre camadas do próprio Terraform ([ADR 0009](./docs/adr/0009-camadas-e-ordem-de-implantacao.md)). O `nx deploy` local nunca aplica infraestrutura como dependência.
- Tudo roda no Floci localmente. Os destinos de container (EC2, ECS, EKS) vêm da documentação do Floci e **não foram testados** na versão fixada.

### Roadmap não é realidade

NestJS, Angular, Go via `@nx-go/nx-go`, o generator `service-java`, o entrypoint e a imagem de container em TypeScript (Go e Quarkus já têm imagem), o target `contract:check`, o Terraform fora do ambiente local e o deploy na AWS estão **planejados e não existem**. Não escreva código, configuração ou documentação que suponha a existência deles. O Angular depende de uma decisão em aberto ([ADR 0005](./docs/adr/0005-angular-no-setup-ts-solution.md)).

### Segurança de alterações

- Não remova seções inteiras de documentação nem mais de 30 linhas de código sem confirmar.
- Antes de renomear ou mover um símbolo, busque todas as referências: imports, mocks de teste, imports dinâmicos, configs.
- Não altere um teste só para fazê-lo passar: corrija o código de produção. Se o teste estiver errado, explique por quê antes.

## Referências

- [`docs/README.md`](./docs/README.md): índice da documentação.
- [`docs/adr/`](./docs/adr/README.md): decisões de arquitetura (numeração de quatro dígitos).
- [`docs/onboarding/`](./docs/onboarding/setup-local.md): ambiente local e Floci.
- [`docs/architecture/overview.md`](./docs/architecture/overview.md): visão C4 e roadmap.
- [`docs/guides/ordem-de-implantacao.md`](./docs/guides/ordem-de-implantacao.md) e [`docs/guides/desempenho-e-recursos.md`](./docs/guides/desempenho-e-recursos.md): camadas e promoção; política e limites da esteira.
- [`docs/guides/release.md`](./docs/guides/release.md): versionamento e publicação com `nx release` ([ADR 0010](./docs/adr/0010-versionamento-e-publicacao-no-github.md)).
- [`docs/guides/`](./docs/guides/nx-tarefas.md): página no backoffice, serviço serverless, tarefas do Nx.
- [`docs/runbooks/TEMPLATE.md`](./docs/runbooks/TEMPLATE.md): modelo de runbook.
- [`apps/backoffice/README.md`](./apps/backoffice/README.md): estrutura e extensão do painel.
- [`.agents/README.md`](./.agents/README.md): rules, agents e skills de IA.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
