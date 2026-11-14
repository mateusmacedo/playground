# example-quarkus: instruções para agentes

Serviço HTTP de exemplo em Java com Quarkus. São dois projetos do Nx: `example-quarkus` (esta pasta, a aplicação Quarkus) e `example-quarkus-core` (`core/`, o núcleo em Java puro). Este arquivo vale para os dois e também para os arquivos Gradle da raiz (`settings.gradle`, `build.gradle`, `gradle.properties` e o wrapper). As convenções comuns de serviço estão no [`AGENTS.md`](../AGENTS.md) de `apps/services`; estrutura, modos de runtime, build nativo e comandos, no [`README.md`](./README.md).

## Gradle e Quarkus

- O build é **Gradle 9.7.0 pelo wrapper `./gradlew`**, multi-projeto na **raiz** (`settings.gradle`, `build.gradle` e `gradle.properties`). Não use um Gradle instalado na máquina. Versões do Quarkus e da plataforma ficam no `gradle.properties`.
- Cada serviço Java são dois projetos Gradle, que viram dois projetos do Nx: o `<serviço>-core` (Java **puro**, sem Quarkus no classpath, com o domínio e os casos de uso) e o `<serviço>` (a aplicação Quarkus, na pasta do `serverless.yml`). O núcleo **nunca** importa Quarkus.
- Os targets do Gradle (`test`, `spotlessCheck`, `quarkusDev` etc.; cerca de 93 no `example-quarkus` e 40 no `example-quarkus-core`, que não tem as tasks do Quarkus) vêm do `@nx/gradle`; no `example-quarkus`, `build`, `pre-deploy`, `deploy` e `remove` vêm do plugin serverless, que vem **depois** do `@nx/gradle` no `nx.json`. No `<serviço>-core`, o `build` é do Gradle e roda o `check` (testes e Spotless). O `@nx/gradle` só declara `ciTestTargetName: "test-ci"`: a opção `buildTargetName` foi removida porque **não tinha efeito** com o plugin de grafo atual. Os targets do Gradle têm como entradas o `settings.gradle`, o `build.gradle` da raiz e o do projeto (via `targetDefaults` com `filter.plugin: "@nx/gradle"`); o `sharedGlobals` **não** alcança esses targets, e o input `production` exclui `src/test/**`. O projeto `playground` do Nx é só a raiz do Gradle: em commit que mexe só nela, use o scope `workspace`.
- O `build` usa a configuration `floci` (JVM, `java21`) por padrão e o build **nativo** nos stages `dev`, `homolog` e `prod`. O nativo exige Docker, leva cerca de 8 min e chegou a cerca de 4,3 GB de pico somados (2,7 GB no container de build e 1,6 GB no Gradle, com `native-image-xmx=2g` e `--memory=3g`): **rode um build nativo por vez** e pare o daemon depois com `./gradlew --stop`.
- Não suba os limites de memória de `gradle.properties` nem do `application.properties` (`native-image-xmx`, `--memory`) sem medir: a máquina divide a RAM com o Floci e o editor.
- O adapter de runtime é escolhido no build (`-Pruntime=lambda|container`), e o artefato de Lambda só roda dentro dela.
- **Obrigatório:** programação reativa e event-driven conforme a rule global `~/.claude/rules/reactive-event-driven.md` do mantenedor (princípios e seção Java) (I/O não bloqueante, pipelines com operadores, sem `synchronized` à mão, as 8 falácias da rede). Aqui, `Uni` e `Multi` do Mutiny ficam só na aplicação Quarkus; o `<serviço>-core` continua em Java puro.
- Testes Java: `pnpm nx run-many -t test -p example-quarkus example-quarkus-core` (ou `./gradlew :example-quarkus:test`).
- Detalhes no [guia](../../../docs/guides/servico-serverless.md#serviço-java-quarkus).

## Formatação (Spotless)

- **O Java é formatado pelo Spotless, e não pelo Biome**: Eclipse 4.41 com o perfil `tools/java/eclipse-formatter.xml` (2 espaços, 80 colunas). Use `pnpm nx spotlessApply <projeto>` para corrigir e `pnpm nx spotlessCheck <projeto>` para verificar; nos dois projetos de uma vez, `pnpm nx run-many -t spotlessCheck -p example-quarkus example-quarkus-core`.
- O `spotlessCheck` roda só no nível completo (`release.yml` e `pnpm check:full`); no PR, o `build` do `<serviço>-core` já roda o `check` do Gradle, com Spotless e testes. O `pre-commit` não roda Java (2 a 8 s com o daemon quente, 22 a 26 s com a JVM fria): corrija à mão com `./gradlew spotlessApply`.
