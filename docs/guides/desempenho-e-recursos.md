# Guia: desempenho e recursos

A esteira segue uma política: **rápida por padrão, completa só no release**. Este guia explica o que roda em cada momento, os limites de recursos que existem para não saturar a máquina (local e de CI) e como ajustá-los. Tudo aqui foi conferido em `nx.json`, `apps/backoffice/vitest.config.mts`, `apps/backoffice-e2e/playwright.config.mts`, `lefthook.yml` e `.github/workflows/`.

## A política em uma tabela

| Momento      | O que roda                                                                                                                                                   | O que fica de fora                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `pre-commit` | `biome check --write --staged --no-errors-on-unmatched` e `gofmt -w` nos `*.go`: só os arquivos do commit                                                    | Java (o Spotless leva 22 a 26 s com a JVM fria) e tudo que não é formatação |
| `pre-push`   | `nx affected -t lint typecheck test --base=origin/main --parallel=2`                                                                                         | Build, e2e e `spotlessCheck`                                                |
| PR (CI)      | Job `Format` (`biome ci` nos arquivos alterados), `Checks` (`nx sync:check` e `nx affected -t lint typecheck test build --parallel=3`, sem coverage) e `E2E` | O que não foi afetado; e2e só se afetado e só no Chromium                   |
| Release      | `release.yml`: Biome em tudo, `nx run-many -t lint typecheck test build spotlessCheck` com coverage, e e2e em todos os browsers                              | Nada                                                                        |

O `release.yml` dispara **só manualmente** (`workflow_dispatch`, com a opção `dry-run`). Os jobs `format`, `checks` e `e2e` rodam primeiro, e o job `release` (`nx release`) só começa se os três passarem. O release de verdade exige a `main`; o `dry-run` vale em qualquer branch. Veja o [guia de release](./release.md).

Os atalhos da raiz reproduzem os dois níveis:

```bash
pnpm check          # nível rápido: o mesmo do pre-push
pnpm check:full     # nível completo: biome ci . e todos os projetos (inclui o spotlessCheck do Java), com coverage
pnpm e2e:full       # e2e em Chromium, Firefox e WebKit
```

## Os limites e onde moram

| Limite                               | Valor padrão                       | Onde está                                                                                                      | Como sobrescrever                                             |
| ------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Tarefas do Nx em paralelo            | `3`                                | `"parallel": 3` no `nx.json`                                                                                   | `NX_PARALLEL=N` ou `--parallel=N`                             |
| Tarefas em paralelo no `pre-push`    | `2`                                | `lefthook.yml` (`--parallel=2`)                                                                                | Edite o `lefthook.yml` (e o script `check` do `package.json`) |
| Workers do Vitest                    | `2`                                | `maxWorkers: 2` em `apps/backoffice/vitest.config.mts`                                                         | `VITEST_MAX_WORKERS=N`                                        |
| Workers do Playwright                | `2` no CI, `50%` dos núcleos local | `workers` em `apps/backoffice-e2e/playwright.config.mts`                                                       | Edite o `playwright.config.mts`                               |
| Heap do Node no CI                   | `--max-old-space-size=3072`        | `env.NODE_OPTIONS` em `ci.yml` e `release.yml`                                                                 | Edite os workflows                                            |
| Daemon do Nx no CI                   | desligado (`NX_DAEMON=false`)      | `env` em `ci.yml` e `release.yml`                                                                              | Edite os workflows                                            |
| Workers do Gradle                    | `2`                                | `org.gradle.workers.max` em `gradle.properties`                                                                | `-Dorg.gradle.workers.max=N` ou edite o arquivo               |
| Heap do daemon do Gradle             | `-Xmx1536m`                        | `org.gradle.jvmargs` em `gradle.properties`                                                                    | Edite o arquivo                                               |
| Ociosidade do daemon do Gradle       | 15 min (`900000` ms)               | `org.gradle.daemon.idletimeout` em `gradle.properties`                                                         | Edite o arquivo; `./gradlew --stop` para na hora              |
| Heap do `native-image`               | `2g`                               | `quarkus.native.native-image-xmx` em `apps/services/example-quarkus/src/main/resources/application.properties` | Edite o arquivo                                               |
| Memória do container do build nativo | `--memory=3g`                      | `quarkus.native.container-runtime-options` no mesmo arquivo                                                    | Edite o arquivo                                               |

### Por que existem

- **Nx e Vitest**: sem limite, o Vitest usa todos os núcleos. Com 3 tarefas do Nx em paralelo isso satura a máquina. Por isso o Vitest fica em 2 workers.
- **Playwright**: o preset usa 1 worker no CI e todos os núcleos localmente. O valor atual (2 no runner de 4 vCPU, metade dos núcleos local) deixa espaço para o servidor do Next, que roda junto.
- **Heap do Node**: o runner tem 4 vCPU e 16 GB, e o `tsc` e o Next estouram o heap padrão do Node quando o monorepo cresce. A variável fica só nos workflows, **nunca no repositório**, para não limitar o uso local.
- **Gradle**: a máquina de desenvolvimento divide a RAM com o Floci, o Next.js e o build nativo. Dois workers e 1,5 GiB de heap bastam para os projetos Java. Cada `gradlew` e cada servidor de linguagem Java do editor sobem o **próprio daemon**; com o padrão de 3 h de ociosidade eles se acumulam e esgotam a memória, por isso o limite de 15 minutos.
- **Build nativo**: sem teto, o `native-image` se dimensiona pela RAM da máquina e disputa memória com o Floci e o editor. O `-Xmx2g` limita o heap e o `--memory=3g` limita o container inteiro, que também cobre o que não é heap.

## Variáveis de controle

| Variável             | Efeito                                                                                            | Quem usa                   |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| `NX_PARALLEL`        | Número de tarefas do Nx em paralelo. Vale mais que o `nx.json`.                                   | Você, localmente           |
| `VITEST_MAX_WORKERS` | Número de workers do Vitest. Vale mais que o `maxWorkers` da config.                              | Você, localmente           |
| `VITEST_COVERAGE=1`  | Liga a cobertura nos testes (`coverage.enabled`). Também se liga com `nx test <proj> --coverage`. | `pnpm check:full`, release |
| `E2E_ALL_BROWSERS=1` | Liga Firefox e WebKit além do Chromium.                                                           | `pnpm e2e:full`, release   |
| `NX_DAEMON=false`    | Desliga o daemon do Nx. Já está desligado nos workflows.                                          | CI, scripts                |

`VITEST_COVERAGE` e `E2E_ALL_BROWSERS` entram no **hash do Nx** (`targetDefaults.test`, na entrada do `@nx/vitest`, e `targetDefaults.e2e`). Efeito prático: uma execução com coverage, ou com todos os browsers, **não reaproveita o cache** da execução sem eles. É o comportamento desejado: resultados diferentes não podem compartilhar cache.

## Como ajustar

Máquina travando durante o `nx run-many` ou o `nx affected`:

```bash
NX_PARALLEL=1 pnpm nx run-many -t test
VITEST_MAX_WORKERS=1 pnpm nx test backoffice
```

O `pnpm check` já passa `--parallel=2` no script; para outro valor, rode o `nx affected` direto, com a flag que quiser.

Máquina folgada e você quer mais velocidade:

```bash
NX_PARALLEL=6 pnpm nx run-many -t lint typecheck test
```

Erro de memória (`heap out of memory`) em `tsc` ou `next build` local:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm nx build backoffice
```

Rodar com coverage só para um projeto:

```bash
pnpm nx test backoffice --coverage
```

Rodar o e2e em todos os browsers:

```bash
pnpm exec playwright install chromium firefox webkit   # uma vez
pnpm e2e:full
```

## Build nativo do Quarkus

O build nativo (configurations `dev`, `homolog` e `prod` do `example-quarkus`, ou `-Dquarkus.native.enabled=true`) é a tarefa mais pesada do repositório. Medido numa máquina de 8 CPUs:

| Medida                                  | Valor                                           |
| --------------------------------------- | ----------------------------------------------- |
| Duração do build                        | cerca de 8 min 5 s (6 min só no `native-image`) |
| Pico de memória no container do builder | 2,71 GB                                         |
| Pico de memória no Gradle               | 1,6 GB                                          |

Por isso:

- **Rode um build nativo por vez.** Dois em paralelo, ou um build nativo com o Floci e o editor já em uso, esgotam a memória de uma máquina de desenvolvimento.
- **Pare o daemon depois**: `./gradlew --stop`. O daemon do Gradle fica em memória até o `idletimeout`.
- O build nativo exige **Docker**, porque o Mandrel roda em container.
- No dia a dia local use a configuration `floci` (build JVM), que é rápida e leve. O nativo é para os stages da AWS.
- **Nenhum workflow roda o build nativo.** O `ci.yml` e o `release.yml` chamam o `build` sem `-c`, então o `build` do Quarkus usa a configuration padrão (`floci`, JVM). O nativo só roda quando você o pede (`-c prod`, por exemplo).
- **O `spotlessCheck` roda só no nível completo** (`release.yml` e `pnpm check:full`), e custa de 26 a 52 s sem cache do Nx. Ele só existe nos projetos Java, e o Nx o pula nos demais. Não dá para mapeá-lo para o target `lint`, porque o `targetDefaults` do Nx não cria targets. No PR, o `build` do `example-quarkus-core` (o `build` do Gradle) já roda o `check`, com Spotless e testes; o módulo da aplicação só passa pelo Spotless no release. O `pre-commit` também não o roda (2 a 8 s com o daemon quente, 22 a 26 s com a JVM fria). Para rodar à mão: `pnpm nx run-many -t spotlessCheck -p example-quarkus example-quarkus-core`, ou corrigir com `./gradlew spotlessApply`.

## Custo do Java na esteira

Medido **sem cache do Nx**, na máquina de desenvolvimento:

| Tarefa                                              | Duração                 |
| --------------------------------------------------- | ----------------------- |
| `example-quarkus-core:test`                         | 21 a 30 s               |
| `example-quarkus:test`                              | 48 a 56 s               |
| `spotlessCheck`                                     | 26 a 52 s               |
| `example-quarkus-core:test` com cache do Nx         | cerca de 6 s            |
| Primeira carga do grafo do Nx (chama o `./gradlew`) | cerca de 27 s           |
| Cargas seguintes do grafo                           | cerca de 3 s, com cache |

Por isso o `spotlessCheck` fica só no nível completo. O `nx affected -t test` roda os testes Java e Go: o `^build` do `targetDefaults.test` vale só para os testes do `@nx/vitest`, e não faz o `affected` ignorá-los.

**O que o `nx affected` roda para Java**: os projetos Gradle entram no `affected` quando há mudança em Java ou nos arquivos de build do Gradle (`build.gradle`, `settings.gradle`, `gradle.properties`). Uma mudança só em documentação ou README afeta apenas o projeto `playground`, que não tem targets úteis, e **não roda nada** de Java.

**Execução completa de referência**: `nx run-many -t lint typecheck test build` com 7 projetos rodou **17 tarefas em 2 min 29 s, sem cache**. A RAM livre ficou em cerca de 6,7 GiB antes e 6,9 GiB depois, com o `gradle.properties` limitando o Gradle a 2 workers e 1,5 GiB de heap.

## O e2e só roda se for afetado

No PR, o job `E2E` pergunta ao Nx se algum projeto com target `e2e` foi afetado:

```bash
pnpm exec nx show projects --affected --withTarget=e2e --json
```

Se a lista vem vazia, o job termina sem instalar o Chromium (custa cerca de 1 minuto) e sem rodar teste. Se há projeto afetado, instala só o Chromium e roda `nx affected -t e2e`. O `backoffice-e2e` depende do `backoffice` (`implicitDependencies`), então uma mudança no painel afeta o e2e.

## Cache e custo

- O cache de tarefas é o **remoto do Nx Cloud**. O CI não guarda `.nx/cache` entre execuções: transportar o diretório local custa cota e o Nx recusa artefatos gerados em outra máquina.
- O `nx affected` compara com o último CI verde (SHAs do `nx-set-shas`), então um PR pequeno roda pouco.
- Os jobs têm `timeout-minutes` (10 no Format, 30 no Checks e 20 no E2E, no PR; 10, 45 e 40 nos jobs de validação do release, mais 30 no job `release`) e o workflow cancela execuções antigas da mesma branch (`concurrency` com `cancel-in-progress`; o release não cancela).

## Checklist ao mexer na esteira

- Um novo limite entra **no arquivo que o aplica**, com um comentário `WHY:` dizendo o porquê, e depois nesta tabela.
- Variável que muda o resultado de uma tarefa precisa entrar nos `inputs` do target, no `nx.json`, para o cache não misturar execuções diferentes.
- Variáveis de limite de memória ficam nos workflows, e não no `package.json` nem no `nx.json`.
