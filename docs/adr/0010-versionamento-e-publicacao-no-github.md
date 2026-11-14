# ADR 0010: Versionamento e publicação no GitHub com nx release

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O repositório já garante **Conventional Commits** com o commitlint (`commit-msg`), mas nada transformava esses commits em versões, changelogs ou artefatos publicados. Faltava decidir onde o ciclo de vida de versão acontece e como cada tipo de artefato (lib npm, imagem de container, Lambda) é publicado.

O projeto de referência do mesmo autor, o jusdocs, não usa GitHub Releases, e o time dele pretende corrigir essa lacuna. Aqui o fluxo já nasce completo.

## Decisão

O ciclo de vida de versão fica **todo no GitHub** e integrado ao **`nx release`**.

### Versão, tag e changelog

- **Conventional Commits** determinam a versão: `feat` gera minor, `fix` gera patch e `!` ou `BREAKING CHANGE` geram major. Os demais tipos não geram release.
- **Versionamento independente por projeto**: cada projeto tem a própria versão e muda só quando tem mudança.
- **Tag `{projectName}@{version}`**, por exemplo `example-ts@0.1.0`. É o padrão do Nx para releases independentes.
- **Changelog por projeto**, em `<pasta-do-projeto>/CHANGELOG.md`, e **uma GitHub Release por projeto e versão** (`changelog.projectChangelogs.createRelease: github`). O Nx não cria GitHub Releases para changelog de projeto e de workspace ao mesmo tempo, então a escolha é o changelog por projeto.
- Commit do release: `chore(release): publish [skip ci]`. O commitlint o aceita (`release` é um dos scopes extras) e o `[skip ci]` evita disparar o CI.

### Grupos de release (chave `release` do `nx.json`)

| Grupo              | Projetos                                                                                 | Onde mora a versão                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `services-js`      | `tag:stack:ts`                                                                           | No `package.json` do projeto.                                                           |
| `services-git-tag` | `tag:platform:serverless` e `!tag:stack:ts` (hoje, o `example-go` e o `example-quarkus`) | Só na tag git. Projetos sem manifesto usam `tools/release/git-tag-version-actions.cjs`. |

**Nenhum grupo publica em registry hoje.** Projetos fora dos grupos (`backoffice`, `nx-serverless`, `infra-local`) não entram no release. Sem tag anterior, o Nx parte da versão em disco (`0.0.0`) ou de `0.0.0` quando não há manifesto, e não é preciso `--first-release`.

O Nx 24 **exige que todo grupo case ao menos um projeto**. Por isso os grupos de libs npm e de imagens (abaixo) só entram no `nx.json` junto com o primeiro projeto de cada tipo.

### Publicação (previsto)

| Artefato                 | Onde é publicado                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Libs npm**             | **GitHub Packages** (`npm.pkg.github.com`), com nome no escopo do dono do repositório (`@mateusmacedo/<lib>`).                                                                                                                                                                                 |
| **Imagens de container** | **GHCR**, em `ghcr.io/mateusmacedo/<projeto>`. A imagem é a mesma construída uma vez, com a tag imutável `sha-<commit>`; o release acrescenta ao **mesmo digest** a tag semântica `<versão>`, a mesma da GitHub Release, como alias, **sem rebuild**. O suporte a Docker no Nx é experimental. |
| **Serviços Lambda**      | Versão, changelog e GitHub Release. O artefato (zip) **não** é anexado pelo Nx; isso exige um passo `gh release upload` no workflow (**a avaliar**).                                                                                                                                           |

O mapeamento do escopo para o registry fica no **`.npmrc`** da raiz (`@mateusmacedo:registry=https://npm.pkg.github.com`), e **não** em `publishConfig.registry` nas libs: a documentação do Nx desaconselha o `publishConfig.registry`, porque ele impede sobrescrever o registry. A autenticação vem do `setup-node` no CI (`NODE_AUTH_TOKEN`), nunca de arquivo versionado.

Os pacotes **internos** continuam no escopo `@org` e **privados**. Só as libs publicáveis usam o escopo do dono.

### Fluxo

- O `.github/workflows/release.yml` roda **só por `workflow_dispatch`**, com a opção `dry-run`.
- Os jobs `format` (`biome ci .`), `checks` (`nx sync:check` e `nx run-many -t lint typecheck test build spotlessCheck`, com coverage) e `e2e` (todos os browsers) rodam **primeiro**. O job `release` depende dos três.
- O release de verdade só roda a partir da `main`. O `dry-run` vale em qualquer branch, porque não altera nada.
- O job `release` tem `contents: write` (commit de release, tags e GitHub Releases) e `packages: write` (GitHub Packages e GHCR), usa `fetch-depth: 0` e `fetch-tags: true`, faz login no GHCR e configura o npm para `npm.pkg.github.com`, no escopo `@mateusmacedo`. Nunca é cancelado no meio (`concurrency: release`).
- O `nx release` roda com `--dry-run` quando a opção está ligada. Se nenhum projeto é publicável (nenhum com o alvo `nx-release-publish` e as tags `publishable` ou `release:image`), roda com `--skip-publish`; caso contrário, com `--yes`.
- Localmente, `pnpm release:dry` (`nx release --dry-run --skip-publish`) ensaia o release sem alterar nada. O script `release` (`nx release --yes`) existe só para o CI.

## Consequências

- **Ganhos**: versão, changelog, tag e Release nascem de uma única operação; cada projeto evolui no próprio ritmo; o histórico de Conventional Commits passa a ter consequência visível; o GitHub concentra código, CI, pacotes e imagens.
- **Custos**: a mensagem de commit vira entrada de contrato, porque define a versão. Commit mal classificado gera versão errada, e o commitlint é a primeira defesa. O workflow precisa de permissões de escrita (`contents` e `packages`).
- **Proteção de branch**: se a `main` exigir PR ou checks, o push do commit e das tags feito pelo `GITHUB_TOKEN` (`github-actions[bot]`) será **recusado**. Será preciso um token de GitHub App ou um PAT com bypass. Pushes feitos com o `GITHUB_TOKEN` não disparam workflows, e o commit de release já tem `[skip ci]`.
- **Sem gatilho por tag**: o `release.yml` não dispara em tag, então as tags `{projectName}@{version}` não iniciam outro workflow.
- **Imagens**: as duas tags **convivem** e apontam para o **mesmo digest**. A imagem é construída uma vez e recebe a tag imutável `sha-<commit>`, que promove entre ambientes ([ADR 0008](./0008-adapters-de-runtime.md)); no release, o mesmo digest recebe também a tag `<versão>` como alias, sem rebuild. Promover o **mesmo** artefato continua valendo. Ainda **a implementar**: confirmar que o fluxo de Docker do Nx adiciona o alias sem reconstruir a imagem, quando o primeiro projeto com imagem existir.
- **Artefatos de Lambda**: o `serverless package` precisa de credenciais AWS ou do Floci, então os zips de TypeScript não saem offline. O zip de Go sai de `nx run example-go:build`, em `apps/services/example-go/.bin/bootstrap.zip`.
- **Hoje**: a chave `release`, o `release.yml` e os scripts `release:dry` e `release` **existem**, e o `release:dry` foi rodado. Só os serviços entram nos grupos, e **nenhum release de verdade foi executado**. Os grupos de libs e de imagens **ainda não existem**: entram com o primeiro projeto de cada tipo.
- **Gatilho de revisão**: necessidade de publicar fora do GitHub (npm público, outro registro), ou de versão única para o workspace inteiro.
