# Guia: tarefas do Nx

Como rodar, cachear e inspecionar tarefas neste monorepo. A regra do repositório: **toda tarefa passa pelo Nx**, e o comando leva o prefixo do gerenciador (`pnpm nx ...`), para usar o Nx instalado no projeto e não um global.

## Vocabulário

| Termo       | O que é                                                             | Exemplo                 |
| ----------- | ------------------------------------------------------------------- | ----------------------- |
| **Projeto** | Uma pasta com `package.json` (ou `project.json`) que o Nx enxerga.  | `backoffice`            |
| **Target**  | Uma ação que o projeto sabe fazer.                                  | `build`, `lint`, `test` |
| **Task**    | Um target aplicado a um projeto (e a uma configuration, se houver). | `backoffice:build`      |
| **Tag**     | Rótulo do projeto, usado para filtrar e para regras de fronteira.   | `scope:backoffice`      |

A maioria dos targets é **inferida por plugins** (`@nx/next`, `@nx/eslint`, `@nx/vitest`, `@nx/playwright`, `@nx/js/typescript`), configurados no `nx.json`. Por isso quase nenhum `package.json` de projeto lista `scripts`.

## Projetos e targets

Confirme sempre no próprio workspace:

```bash
pnpm nx show projects
pnpm nx show project backoffice --json
```

Quadro atual dos principais targets:

| Projeto                | Targets                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backoffice`           | `dev`, `build`, `start`, `serve-static`, `lint`, `test`, `test-ci`                                                                                                                                |
| `backoffice-e2e`       | `e2e`, `e2e-ci`, `lint`, `typecheck`                                                                                                                                                              |
| `infra-local`          | `up`, `down`, `reset`, `logs`, `status`, `validate`                                                                                                                                               |
| `example-ts`           | `test`, `typecheck`, `lint`, `pre-deploy`, `package`, `deploy`, `pre-remove`, `remove`, `invoke-local`                                                                                            |
| `example-go`           | `test`, `build`, `pre-deploy`, `package`, `deploy`, `pre-remove`, `remove`, `invoke-local`                                                                                                        |
| `example-quarkus`      | `test`, `spotlessCheck`, `quarkusDev` e as demais tasks do Gradle (**93 targets**), mais `build`, `pre-deploy`, `package`, `deploy`, `pre-remove`, `remove` e `invoke-local` do plugin serverless |
| `example-quarkus-core` | Tasks do Gradle (`test`, `spotlessCheck`, `build`...); o `build` é o do Gradle e roda o `check`                                                                                                   |
| `playground`           | Raiz do build Gradle, sem targets úteis                                                                                                                                                           |
| `nx-serverless`        | `test`, `typecheck`, `lint`                                                                                                                                                                       |

`build-deps` e `watch-deps` também existem para os projetos com dependências construíveis. O `backoffice` não tem `typecheck`: o `next build` faz a checagem de tipos. Os targets de serviço (`pre-deploy`, `deploy`...) vêm do plugin local `tools/serverless`; veja o [guia de serviço serverless](./servico-serverless.md).

## Rodar tarefas

```bash
# um target em um projeto
pnpm nx build backoffice
pnpm nx run backoffice:build          # forma completa

# um target em vários projetos
pnpm nx run-many -t lint test

# só o que a mudança afeta
pnpm nx affected -t lint test typecheck build
pnpm nx affected -t test --base=origin/main --head=HEAD
```

- `affected` compara a sua branch com uma base e roda só nos projetos que mudaram **e** nos que dependem deles. O CI usa `nrwl/nx-set-shas`, que define `NX_BASE` e `NX_HEAD`; o hook `pre-push` usa `--base=origin/main`.
- Argumentos para a ferramenta por baixo vão depois de `--`: `pnpm nx e2e backoffice-e2e -- --project=chromium`.
- `--parallel=3` limita a concorrência (o `nx.json` já define `"parallel": 3` como padrão); `--verbose` mostra mais detalhes de uma falha.

## Cache

Targets com `cache: true` (como `build`, `lint` e `test` nos projetos TypeScript) guardam a saída. Se nenhuma **entrada** mudou desde a última execução, o Nx repete o resultado do cache em vez de rodar de novo.

- **Entradas**: definidas pelos `namedInputs` do `nx.json`.
  - `default`: todos os arquivos do projeto, mais os `sharedGlobals`.
  - `production`: o `default` sem o que não afeta o artefato (configs de ESLint, Biome, Vitest e Playwright, specs, testes Go, `tsconfig.spec.json`).
  - `sharedGlobals`: `tsconfig.base.json`, `eslint.config.mjs` e `biome.json` da raiz e `pnpm-workspace.yaml`. Mudou um deles, todos os projetos invalidam.
- **Saídas** (`outputs`): o que o Nx guarda e restaura. O `build` do backoffice guarda o `.next` (menos o `cache`).
- **Cache remoto**: o workspace está conectado ao Nx Cloud (`nxCloudId`), então o cache é compartilhado entre máquinas e CI.

```bash
pnpm nx build backoffice --skip-nx-cache   # ignora o cache nesta execução
pnpm nx reset                              # limpa cache local e o daemon
```

Targets com efeito colateral (`dev`, `up`, `down`, `e2e`) não são cacheados.

## targetDefaults

O `nx.json` define padrões por target. Cada entrada pode ter um `filter.plugin`, que restringe o padrão aos targets **inferidos por aquele plugin**. Isso importa porque o repositório mistura plugins (`@nx/next`, `@nx/vitest`, `@nx/gradle`, o plugin serverless...) e um padrão sem filtro vale para todos.

| Target        | Entrada                                                    | Configuração                                                                                                                    | Efeito                                                                                                                                                      |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`       | sem filtro                                                 | `dependsOn: ["^build"]`, `cache: true`                                                                                          | Antes de construir, constrói as dependências; vale para todos os projetos.                                                                                  |
| `build`       | `@nx/next/plugin` e `@nx/js/typescript` (uma entrada cada) | `inputs: ["production", "^production"]`                                                                                         | O cache do build do Next e do TypeScript ignora arquivos de teste e de configuração de lint.                                                                |
| `*` e `build` | `@nx/gradle`                                               | `inputs`: o que já valia, mais `{workspaceRoot}/settings.gradle`, `{workspaceRoot}/build.gradle` e `{projectRoot}/build.gradle` | Mudar o build do Gradle invalida o cache dos targets do Gradle. O `sharedGlobals` **não** alcança esses targets (testado), por isso as entradas ficam aqui. |
| `test`        | `@nx/vitest`                                               | `dependsOn: ["^build"]` e a variável `VITEST_COVERAGE` nas entradas                                                             | Só os testes do Vitest rodam depois do build das dependências. Com `VITEST_COVERAGE=1` o hash muda e o cache sem coverage não é reaproveitado.              |
| `e2e`         | sem filtro                                                 | a variável `E2E_ALL_BROWSERS` nas entradas                                                                                      | Rodar com todos os browsers também gera outro hash.                                                                                                         |

O `^` em `^build` significa "o target `build` dos projetos de que este depende". Sem `^`, seria o próprio projeto.

**Por que o `test` tem filtro.** O `dependsOn: ["^build"]` do `test` já valeu para todos os plugins. Nos projetos Java, isso fazia o `nx affected -t test` **ignorar os testes do Gradle**. Com o `filter.plugin: "@nx/vitest"`, ele vale só para os testes do Vitest, e os testes Java rodam normalmente. Ao acrescentar um plugin que infere `test`, decida se o padrão deve valer para ele.

**O que o `targetDefaults` não faz.** Ele ajusta targets que já existem, mas **não cria** target. É por isso que o `spotlessCheck` (que só existe nos projetos Java) não pode ser mapeado para o `lint` por aqui: ele é pedido pelo nome (`nx run-many -t lint typecheck test build spotlessCheck`, no nível completo), e o Nx o pula nos projetos que não o têm. No PR, o `build` do `example-quarkus-core` já roda o `check` do Gradle, que inclui o Spotless.

Para mudar o comportamento de **um** projeto, configure o target no `package.json` (campo `nx`) ou no `project.json` dele. Para mudar o de todos os projetos de um plugin, use `targetDefaults` com `filter.plugin`.

## Sync

O plugin `@nx/js/typescript` mantém as `references` do `tsconfig.json` da raiz e dos projetos alinhadas com as dependências do workspace. Isso é um **sync generator**.

```bash
pnpm nx sync          # aplica as correções
pnpm nx sync:check    # só verifica; falha se algo estiver fora de sincronia
```

O `nx.json` tem `sync.applyChanges: true`: ao rodar um target, o Nx aplica as correções sozinho, sem perguntar. O CI roda `nx sync:check` primeiro e falha se o commit esqueceu de incluir o resultado do sync.

## Tags e fronteiras

Cada projeto declara tags:

| Projeto           | Tags                                            | Onde estão                        |
| ----------------- | ----------------------------------------------- | --------------------------------- |
| `backoffice`      | `scope:backoffice`, `type:app`                  | campo `nx.tags` do `package.json` |
| `infra-local`     | `scope:infra`, `type:tool`                      | `project.json`                    |
| `example-ts`      | `type:app`, `stack:ts`, `platform:serverless`   | `project.json`                    |
| `example-go`      | `type:app`, `stack:go`, `platform:serverless`   | `project.json`                    |
| `example-quarkus` | `type:app`, `stack:java`, `platform:serverless` | `project.json`                    |
| `nx-serverless`   | `type:tool`, `scope:shared`                     | `project.json`                    |

Os projetos do Gradle (`example-quarkus-core` e `playground`) vêm do `@nx/gradle` e não declaram tags. Use as tags para filtrar:

```bash
pnpm nx run-many -t lint --projects=tag:type:app
```

A regra `@nx/enforce-module-boundaries` está ativa no `eslint.config.mjs` da raiz, mas hoje a única restrição é `sourceTag: '*'` podendo depender de `'*'`: **tudo pode depender de tudo**. Quando surgirem as primeiras libs, restrinja por tag, por exemplo:

```js
depConstraints: [
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
  { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
],
```

## Formatação e lint

O repositório usa um modelo **híbrido** ([ADR 0007](../adr/0007-lint-e-formatacao-biome-eslint-minimo.md)):

- **Biome** (`biome.json` na raiz) formata JS, TS, JSON, CSS, SCSS, YAML e Markdown, e linta JS, TS, JSON e CSS, com organização de imports e os domínios `next`, `react`, `test` e `playwright`.
- **ESLint mínimo**: só a regra `@nx/enforce-module-boundaries`, que depende do grafo do Nx. O target `lint` do Nx roda apenas isso.
- **O Biome não formata Go nem Java.** Go usa o `gofmt` (o `pre-commit` o roda nos arquivos do commit, e o job `Format` falha se `gofmt -l` listar algum arquivo). Java usa o Spotless, pelo target `spotlessCheck`/`spotlessApply` de cada projeto Gradle; ele não roda no `pre-commit` (2 a 8 s com o daemon quente, 22 a 26 s com a JVM fria), e à mão se corrige com `./gradlew spotlessApply`.
- **Prettier não existe.** O `nx format` só reconhece Prettier e oxfmt, então `pnpm nx format:check` e `format:write` **não funcionam** ("No formatter configured"). Use os scripts da raiz.

```bash
pnpm format          # corrige (biome check --write .)
pnpm format:check    # só verifica (biome ci .)
pnpm lint            # Biome (biome lint .) e as fronteiras do Nx (nx run-many -t lint)
pnpm nx affected -t lint   # só as fronteiras, nos projetos afetados
```

Para formatar só alguns arquivos:

```bash
pnpm exec biome check --write docs/README.md README.md
```

O hook `pre-commit` roda `biome check --write --staged` (e `gofmt -w` nos `*.go` do commit) e o job `Format` do CI roda `biome ci` (e `gofmt -l`), então o que sai do `pnpm format` passa nos dois. O Biome respeita o `.gitignore`, e o `biome.json` exclui o `pnpm-lock.yaml` e o `next-env.d.ts`, que as ferramentas reescrevem.

## Atalhos da raiz

Definidos em `package.json`:

| Script            | O que roda                                                                                      | Quando usar                          |
| ----------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| `pnpm check`      | `nx affected -t lint typecheck test --base=origin/main --parallel=2`                            | Nível rápido, o mesmo do `pre-push`. |
| `pnpm check:full` | `biome ci .` e `nx run-many -t lint typecheck test build spotlessCheck` com `VITEST_COVERAGE=1` | Nível completo, o do release.        |
| `pnpm e2e:full`   | `nx run-many -t e2e` com `E2E_ALL_BROWSERS=1`                                                   | E2E em Chromium, Firefox e WebKit.   |

## Inspecionar e depurar

```bash
pnpm nx graph                              # grafo de dependências no navegador
pnpm nx show project backoffice --json     # targets, inputs, outputs
NX_DAEMON=false pnpm nx show projects      # sem o daemon, útil em script e CI
pnpm nx reset                              # cache e daemon do zero
```

Se um resultado parecer cacheado quando não deveria, `pnpm nx show project <nome> --json` mostra os `inputs` do target; arquivo fora das entradas não invalida o cache.

## Criar projeto ou lib

Use os geradores, não cópia de pasta. Descubra o gerador certo pela skill `nx-generate` e rode com `--dry-run` primeiro:

```bash
pnpm nx g @nx/js:lib packages/my-lib --dry-run
```

Depois do gerador, rode `pnpm install` (para o pnpm ligar o pacote novo ao workspace) e `pnpm nx sync`.

## No CI

A política é **rápida por padrão, completa só no release**.

O `.github/workflows/ci.yml` (PR e push na `main`) tem três jobs:

| Job      | O que roda                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------- |
| `Format` | `biome ci`: só nos arquivos alterados no PR; no repositório inteiro no push para a `main`.     |
| `Checks` | `nx sync:check`, depois `nx affected -t lint typecheck test build --parallel=3` e `nx fix-ci`. |
| `E2E`    | `nx affected -t e2e` no Chromium, e só se algum projeto de e2e foi afetado.                    |

O `.github/workflows/release.yml` (só disparo manual, com a opção `dry-run`) roda o nível completo, com `biome ci .`, `nx run-many -t lint typecheck test build spotlessCheck` com coverage e `nx run-many -t e2e` em todos os browsers, e **depois** o `nx release` (veja o [guia de release](./release.md)).

O job `Checks` usa o `nrwl/nx-set-shas`, que define `NX_BASE` e `NX_HEAD` para o `affected` comparar com o último CI verde. O `nx fix-ci` aciona o self-healing do Nx Cloud, que propõe correções para falhas; o acompanhamento de uma execução é feito pela skill `monitor-ci`. O cache de tarefas é o remoto do Nx Cloud: o CI não guarda `.nx/cache` entre execuções.
