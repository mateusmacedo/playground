# Guia: release

Como o repositório transforma Conventional Commits em versões, changelogs e GitHub Releases, tudo no GitHub e com o **`nx release`**. A decisão está no [ADR 0010](../adr/0010-versionamento-e-publicacao-no-github.md).

> **Estado atual.** A chave `release` do `nx.json`, o `.github/workflows/release.yml` (com `nx release`) e os scripts `release:dry` e `release` do `package.json` **existem** e foram ensaiados em dry-run. **Nenhum release de verdade foi executado**, e **nenhum grupo publica em registry**: hoje só os serviços serverless são versionados e ganham GitHub Release. As seções "Adicionar uma lib publicável" e "Adicionar um serviço com imagem" descrevem como **estender** a configuração. Confira o `nx.json`, o `release.yml` e o `package.json` antes de depender de um detalhe.

## Como funciona

| Peça                         | O que faz                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Conventional Commits**     | Definem a versão (já garantidos pelo commitlint no `commit-msg`).                                         |
| **Releases independentes**   | Cada projeto tem a própria versão e muda só quando tem mudança.                                           |
| **Tag `{projeto}@{versão}`** | Uma tag por projeto e versão, por exemplo `example-ts@0.1.0`.                                             |
| **Changelog por projeto**    | Gerado em `<pasta-do-projeto>/CHANGELOG.md`, por exemplo `apps/services/example-ts/CHANGELOG.md`.         |
| **GitHub Release**           | Uma por projeto e versão (`createRelease: github`), com o texto do changelog.                             |
| **Commit do release**        | `chore(release): publish [skip ci]`, feito pelo `github-actions[bot]`. O `[skip ci]` evita disparar o CI. |

### Como a mensagem de commit vira versão

O `nx release` lê os commits desde a última tag de cada projeto:

| Commit                                                | Efeito                       |
| ----------------------------------------------------- | ---------------------------- |
| `fix(example-ts): ...`                                | Patch (`1.2.0` para `1.2.1`) |
| `feat(example-ts): ...`                               | Minor (`1.2.0` para `1.3.0`) |
| `feat(example-ts)!: ...` ou rodapé `BREAKING CHANGE:` | Major (`1.2.0` para `2.0.0`) |
| `docs`, `chore`, `test`, `ci`, `refactor`...          | **Não geram release**        |

O **scope** do commit é o nome do projeto Nx (veja o `commitlint.config.mjs`), e é por ele que o commit se associa a um projeto. Um commit que mexe em um projeto deve levar o scope dele, e nunca `workspace` ou outro genérico, quando a mudança é daquele projeto.

### Primeiro release

Sem tag anterior, o Nx parte da **versão em disco** (`0.0.0` no `package.json`) ou de `0.0.0` quando o projeto não tem manifesto, e calcula o próximo número pelos commits. **Não é preciso** `--first-release`. No dry-run de hoje, os serviços (`example-ts`, `example-go` e `example-quarkus`) saem como `0.0.1`.

## Grupos de release (hoje)

A chave `release.groups` do `nx.json` tem dois grupos, ambos de serviços serverless:

| Grupo              | Projetos                                                                                 | Onde mora a versão                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services-js`      | `tag:stack:ts` (hoje, o `example-ts`)                                                    | No `package.json` do projeto.                                                                                                                                                   |
| `services-git-tag` | `tag:platform:serverless` e `!tag:stack:ts` (hoje, o `example-go` e o `example-quarkus`) | **Só na tag git.** Projetos sem manifesto não têm onde guardar a versão, e `tools/release/git-tag-version-actions.cjs` faz da tag `{projectName}@{version}` a fonte da verdade. |

Projetos **fora dos grupos** (`backoffice`, `nx-serverless` e `infra-local`) **não entram** no release.

## O que é publicado e onde

| Artefato                | Destino                                | Hoje                                                                      |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| **Serviço Lambda**      | GitHub Release do projeto              | Versão, changelog e Release. O zip **não** é anexado (veja "Limitações"). |
| **Lib npm**             | GitHub Packages, `npm.pkg.github.com`  | Previsto. Ainda não há libs; veja "Adicionar uma lib publicável".         |
| **Imagem de container** | GHCR, `ghcr.io/mateusmacedo/<projeto>` | Previsto. Ainda não há imagens; veja "Adicionar um serviço com imagem".   |
| **Pacote interno**      | Não é publicado                        | Escopo `@org`, `private: true`.                                           |

## Como rodar

### No GitHub

Actions, **Release**, **Run workflow**, com a opção `dry-run` e o campo opcional `version`. O workflow não tem gatilho por tag.

Com o `version` vazio, o Nx calcula a versão pelos commits. Preenchido, o valor vai para o `nx release` como especificador e vale para todos os projetos dos grupos de release: uma versão explícita (`1.0.0-rc.1`) ou uma palavra do Nx (`patch`, `minor`, `major`, `prerelease`). Um valor fora desses formatos faz o job `release` falhar antes de versionar.

**Release candidate**: use ponto antes do número (`1.0.0-rc.1`, `1.0.0-rc.2`). Com hífen (`1.0.0-rc-01`), o próximo `prerelease` calculado pelo Nx sai `1.0.0-rc.0`, que o semver ordena antes da versão anterior.

```text
 workflow_dispatch (dry-run: sim ou não; version: vazio ou informado)
        |
        v
 jobs de validação, em paralelo
      - format : biome ci .
      - checks : nx sync:check e nx run-many -t lint typecheck test build spotlessCheck (coverage)
      - e2e    : e2e em Chromium, Firefox e WebKit
        |
        v  só se os três passaram
 job release
      - dry-run: roda em qualquer branch e não altera nada
      - de verdade: só a partir da main
      - nx release
          - calcula as versões pelos commits, ou usa a version informada
          - atualiza o changelog de cada projeto
          - cria o commit "chore(release): publish [skip ci]" e as tags {projeto}@{versão}
          - cria a GitHub Release de cada projeto e versão
          - publica libs e imagens, quando existirem
```

Detalhes do job `release`:

- **Permissões**: `contents: write` (commit, tags e Releases) e `packages: write` (GitHub Packages e GHCR). Não há `id-token: write`, porque o GitHub Packages não tem proveniência do npm.
- **Histórico**: `fetch-depth: 0` e `fetch-tags: true`, porque o Nx precisa de todas as tags para achar a versão atual de cada projeto.
- **Autenticação**: o `GITHUB_TOKEN` do workflow, para o `nx release`, para o npm (`NODE_AUTH_TOKEN`) e para o login no GHCR.
- **Autor do commit**: `github-actions[bot]`. O Lefthook é desligado (`LEFTHOOK=0`) nesse commit, porque o código já passou pela validação dos jobs anteriores.
- **Nada publicável**: o workflow conta os projetos com o alvo `nx-release-publish` e as tags `publishable` ou `release:image`. Se o número é zero (o caso de **hoje**), roda o `nx release` com `--skip-publish`, que só versiona e cria as Releases; senão, com `--yes`.
- **Dry-run com imagens**: no `dry-run` o Nx não constrói as imagens antes de versionar, então o workflow roda `docker:build` nos projetos que têm Dockerfile.
- **Concorrência**: um release por vez e **nunca cancelado** (`concurrency: release`), porque cancelar entre o push das tags e a publicação deixaria tag sem pacote.

### No seu computador

```bash
git fetch --tags
pnpm release:dry        # nx release --dry-run --skip-publish
```

O `release:dry` mostra as versões, os changelogs e as GitHub Releases que seriam criados, **sem alterar nada**. Rode `git fetch --tags` antes: o Nx lê as tags do seu clone e, sem elas, calcula versões sobre um histórico desatualizado.

O script `release` (`nx release --yes`) existe **só para o CI**: fora dele (sem a variável `CI`), o script aborta e aponta o `pnpm release:dry`. Publicar de verdade é um passo do GitHub, depois da validação completa: não rode o release de verdade pela sua máquina. Se o release falhar depois do push das tags, ou sair errado, siga o [runbook de recuperação](../runbooks/release-recuperacao.md).

## Pré-requisitos no GitHub

- **Proteção de branch.** O ruleset da `main` exige PR, checks e histórico linear ([ADR 0015](../adr/0015-metas-de-qualidade-e-gate-obrigatorio.md)), e um push do `GITHUB_TOKEN` seria **recusado**. A única exceção do ruleset são as deploy keys: o job `release` faz o checkout com a deploy key do secret **`RELEASE_DEPLOY_KEY`** (chave SSH com escrita, cadastrada em Settings, Deploy keys), e o `nx release` grava o commit e as tags por ela. Sem o secret, o push falha. O commit de release tem `[skip ci]`, então não dispara os workflows de novo. Para girar a chave, gere outra, cadastre a pública como deploy key com escrita, troque o secret e remova a antiga.
- **Metas do SonarQube.** O job `quality` reprova o release se a última análise da `main` não for do commit que vira versão ou se as metas do ADR 0015 não forem atendidas.
- **Pacotes npm** vão para o GitHub Packages (`https://npm.pkg.github.com`), e o **nome do pacote precisa ter o escopo do dono**: `@mateusmacedo/<nome>`. O mapeamento do escopo para o registry fica no `.npmrc` da raiz (`@mateusmacedo:registry=https://npm.pkg.github.com`). Prefira o `.npmrc` ao `publishConfig.registry`: a documentação do Nx desaconselha o segundo, porque ele impede sobrescrever o registry. A autenticação vem do `setup-node` no CI e **nunca** do arquivo versionado.
- **Imagens** vão para `ghcr.io/mateusmacedo/<projeto>`.

## Adicionar uma lib npm publicável

O Nx 24 **exige que todo grupo case ao menos um projeto**. Por isso o grupo de libs só entra no `nx.json` **junto com a primeira lib**.

1. Crie a lib por um gerador do Nx (skill `nx-generate`).
2. No `package.json` da lib:

   ```json
   {
     "name": "@mateusmacedo/my-lib",
     "version": "0.0.0",
     "nx": { "tags": ["type:lib", "publishable"] }
   }
   ```

   Sem `"private": true`, e com o nome no escopo do **dono** do repositório. Pacotes internos seguem em `@org` e privados.

3. No `nx.json`, em `release.groups`:

   ```json
   "libs": { "projects": ["tag:publishable"] }
   ```

4. Rode `pnpm release:dry`. Deve aparecer `Would publish to https://npm.pkg.github.com`.

## Adicionar um serviço ou app com imagem

O suporte a Docker no Nx é **experimental**. O plugin `@nx/docker` já está instalado e registrado.

1. Coloque um `Dockerfile` no projeto.
2. Dê ao projeto a tag `release:image`.
3. Informe o repositório da imagem: `nx.release.docker.repositoryName: "mateusmacedo/<projeto>"` no `package.json` (ou `release.docker.repositoryName` no `project.json`).
4. No `nx.json`, em `release.groups`:

   ```json
   "images": {
     "projects": ["tag:release:image"],
     "docker": {
       "registryUrl": "ghcr.io",
       "versionSchemes": { "production": "{versionActionsVersion}" }
     }
   }
   ```

A imagem é construída **uma vez** e recebe a tag imutável **`sha-<commit>`** ([ADR 0008](../adr/0008-adapters-de-runtime.md)), que promove entre ambientes. No release, o **mesmo digest** recebe também a tag semântica `<versão>` (por exemplo `ghcr.io/mateusmacedo/api:0.0.1`, a mesma da GitHub Release) como alias, **sem rebuild**: as duas tags convivem e apontam para a mesma imagem. Confirmar que o fluxo de Docker do Nx adiciona o alias sem reconstruir é **a implementar**, junto com o primeiro projeto com imagem. No `dry-run`, o Nx não constrói a imagem antes de versionar, e o workflow já cuida disso.

## Limitações

- **Arquivos na Release**: o Nx **não anexa** arquivos (o zip da Lambda, o `bootstrap.zip`) a uma GitHub Release. Isso exige um passo `gh release upload <projeto>@<versão> <arquivo>` no workflow, depois do `nx release` (**a avaliar**).
- **Zips de Lambda**: o `serverless package` precisa de credenciais AWS ou do Floci, então os zips de TypeScript não saem offline. O zip de Go sai de `nx run example-go:build`, em `apps/services/example-go/.bin/bootstrap.zip`.
- **Docker no Nx** é experimental.

## Antes de disparar um release

- [ ] A `main` está verde no CI.
- [ ] Os commits desde o último release têm tipo e scope corretos (o commitlint ajuda, mas não conhece a intenção).
- [ ] O `dry-run` mostrou as versões que você esperava.
- [ ] A proteção de branch permite o push do bot (veja "Pré-requisitos no GitHub").
- [ ] Nenhum segredo em arquivo versionado nem em variável `NEXT_PUBLIC_*`.

## Problemas comuns

| Sintoma                                                 | Causa provável                                                                 | O que fazer                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| O dry-run não encontra mudança em um projeto            | Os commits não têm o scope do projeto, ou são de um tipo que não gera release. | Confira o scope e o tipo dos commits.                                                                   |
| Versão maior ou menor do que o esperado                 | Commit classificado errado (`feat` em vez de `fix`, ou `!` esquecido).         | Não reescreva a história da `main`; corrija com um commit novo e revise no dry-run.                     |
| O job `release` não aparece ou é pulado                 | O release de verdade só roda a partir da `main`.                               | Rode a partir da `main`, ou ligue o `dry-run` para ensaiar em outra branch.                             |
| O push do commit ou das tags é recusado                 | A `main` está protegida e o `GITHUB_TOKEN` não tem bypass.                     | Use um token de GitHub App ou um PAT com bypass.                                                        |
| O release só versiona e não publica                     | Nenhum projeto tem o alvo `nx-release-publish` (nenhuma lib nem imagem).       | É o esperado hoje. Veja "Adicionar uma lib npm publicável" ou "Adicionar um serviço ou app com imagem". |
| O `nx release` falha por causa de um grupo sem projetos | Um grupo no `nx.json` não casa nenhum projeto (o Nx 24 exige ao menos um).     | Só declare o grupo junto com o primeiro projeto dele.                                                   |
| `403` ao publicar no GitHub Packages                    | Falta `packages: write`, ou o escopo difere do dono do repositório.            | Confira as permissões do workflow e o nome `@mateusmacedo/<lib>`.                                       |
| O release falhou depois do push das tags                | A publicação falhou com o commit, as tags e as Releases já criados.            | Reexecutar o job não resolve; siga o [runbook de recuperação](../runbooks/release-recuperacao.md).      |
| `E404` ao instalar uma lib publicada                    | O consumidor não aponta o escopo para o registro do GitHub.                    | Configure `@mateusmacedo:registry=https://npm.pkg.github.com` no `.npmrc` de quem consome.              |
