# Runbook: recuperar ou desfazer um release

Como agir quando o workflow **Release** (`nx release`) falha **depois** do push das tags, e como desfazer um release que saiu errado. O funcionamento normal está no [guia de release](../guides/release.md) e a decisão no [ADR 0010](../adr/0010-versionamento-e-publicacao-no-github.md).

- **Responsável**: mantenedores do repositório
- **Última revisão**: 2026-11-14
- **Ambiente**: GitHub (workflow `Release`, GitHub Packages e GHCR); não há ambiente AWS
- **Duração estimada**: 15 a 30 minutos

> **Estado atual.** Nenhum release de verdade foi executado, e hoje só os serviços serverless são versionados (commit de release, tags e GitHub Releases). Não há lib npm nem imagem publicada: os passos de registry (GitHub Packages e GHCR) valem a partir do primeiro grupo publicável. Os de git e GitHub Release valem já.

## Quando usar

- O job `release` falhou ou foi cancelado **depois** do push do commit `chore(release): publish [skip ci]` e das tags `{projeto}@{versão}`. O `nx release` segue a ordem versão, changelog, commit e tags com push, GitHub Release, publicação: falhar na publicação deixa tag e Release sem pacote.
- O release saiu com versão, changelog ou artefato errados e precisa ser desfeito.

Falha **antes** do push (job vermelho sem commit nem tag novos no `main`): não há nada a desfazer. Corrija a causa e dispare o workflow de novo.

## Impacto

- Tag e GitHub Release publicadas ficam visíveis a quem consome o repositório. Quem já baixou uma versão de registry continua com ela.
- O commit de release no `main` altera `package.json` e `CHANGELOG.md`; se a tag for apagada e o commit ficar, o `package.json` passa a declarar uma versão que não existe mais.
- Versão publicada em registry **não volta**: só pode ser marcada como obsoleta ou excluída (veja "Rollback").

## Pré-requisitos

- [ ] `gh` autenticado com permissão de escrita no repositório (`gh auth status`).
- [ ] Para o registry: um token **classic** com `write:packages` (publicar) e `delete:packages` e `repo` (excluir versão). O `GITHUB_TOKEN` do workflow não existe fora dele.
- [ ] Clone atualizado: `git fetch --tags --prune`.
- [ ] O link da execução do workflow `Release` que falhou, com o passo em que parou.

## Passos

### 1. Diagnosticar onde parou

```bash
git fetch --tags --prune
git log origin/main -5 --format='%h %an %s'
git tag --list '*@*' --sort=-creatordate | head
gh release list --limit 10
```

Esperado: o commit `chore(release): publish [skip ci]` do `github-actions[bot]`, as tags novas e as GitHub Releases do mesmo release. O que falta indica o passo que falhou.

| O que existe                        | Onde parou                | Caminho                             |
| ----------------------------------- | ------------------------- | ----------------------------------- |
| Nada novo                           | Antes do push             | Corrija a causa e dispare de novo   |
| Commit e tags, sem Release          | Criação da GitHub Release | Passo 2 (completar) ou 3 (desfazer) |
| Commit, tags e Releases, sem pacote | Publicação                | Passo 2 (completar)                 |
| Release com versão ou artefato ruim | Já concluído              | Passo 3 (desfazer)                  |

### 2. Completar a publicação que falhou

Reexecutar o job **não** funciona: o `nx release` não acha mudança nova, porque o commit e as tags já existem. Publique à parte, a partir do commit do release.

1. Posicione-se no commit de release que está no `main`.

   ```bash
   git switch --detach "<projeto>@<versão>"
   pnpm install --frozen-lockfile
   ```

   Esperado: o `package.json` do projeto com a versão do release.

2. Ensaie só os projetos que faltam publicar.

   ```bash
   NODE_AUTH_TOKEN="<token com write:packages>" \
     pnpm exec nx release publish --projects=<projeto> --dry-run
   ```

   Esperado: `Would publish to https://npm.pkg.github.com` (lib) ou o push da imagem, só para os projetos listados.

3. Publique.

   ```bash
   NODE_AUTH_TOKEN="<token com write:packages>" \
     pnpm exec nx release publish --projects=<projeto>
   ```

   O registry recusa republicar uma versão que já existe (`403` ou `409`): por isso a lista de `--projects` deve ter **só** os que não foram publicados. Para imagens, faça `docker login ghcr.io` com o mesmo token antes.

4. Volte ao `main`.

   ```bash
   git switch main
   ```

### 3. Desfazer um release

Na ordem: registry, GitHub Release e tag, commit de release. Cada passo só vale se o anterior no fluxo chegou a acontecer.

1. **Registry** (só se publicou). Liste para achar o nome e o id exatos e depois exclua a versão, ou marque-a como obsoleta.

   ```bash
   gh api '/user/packages?package_type=npm' --jq '.[].name'
   gh api '/user/packages/npm/<nome-sem-escopo>/versions' --jq '.[] | "\(.id) \(.name)"'
   gh api -X DELETE '/user/packages/npm/<nome-sem-escopo>/versions/<id>'
   ```

   Para uma imagem, troque `npm` por `container`; a versão traz as tags em `.metadata.container.tags`. A alternativa que mantém a versão listada, para lib npm:

   ```bash
   npm deprecate "@mateusmacedo/<lib>@<versão>" "motivo; use <versão boa>" \
     --registry=https://npm.pkg.github.com
   ```

   A documentação do GitHub Packages **não cita** o `npm deprecate`: confirme no primeiro uso que o registry o aceita. Se recusar, use a exclusão acima.

2. **GitHub Release e tag.** Apague **antes** de disparar outro release: a tag antiga distorce o cálculo da versão seguinte.

   ```bash
   gh release delete "<projeto>@<versão>" --cleanup-tag --yes
   git tag --delete "<projeto>@<versão>"
   ```

   Esperado: `gh release list` sem a versão e `git ls-remote --tags origin "<projeto>@<versão>"` vazio. A segunda linha só limpa a tag do seu clone.

3. **Commit de release.** Reverta por PR, **sem force push** no `main`. Use `--no-commit` para trocar a mensagem: o subject original traz `[skip ci]`, e um revert com essa marca não rodaria o CI.

   ```bash
   git switch -c chore/undo-release-<projeto>
   git revert --no-commit <sha do chore(release): publish [skip ci]>
   git commit -m "revert(release): undo the <projeto> <versão> release"
   gh pr create --assignee @me --title "revert(release): undo the <projeto> <versão> release"
   ```

   Esperado: o `package.json` e o `CHANGELOG.md` de volta à versão anterior. Depois do merge, rode `pnpm release:dry` e confira que a versão proposta é a esperada.

4. Se a causa foi corrigida, dispare o workflow **Release** de novo, primeiro com `dry-run`.

## Verificação

```bash
gh release list --limit 10
git ls-remote --tags origin '*@*'
pnpm release:dry
```

Esperado: a versão desfeita não aparece em `gh release list` nem nas tags remotas, e o `release:dry` propõe a versão que o próximo release deve ter. Para registry, a listagem de versões do passo 3.1 sem a versão excluída.

## Rollback

Desfazer a recuperação, na ordem inversa:

- **Commit de revert**: reverta o merge do PR do passo 3.3.
- **Tag**: recrie no mesmo commit com `git tag "<projeto>@<versão>" <sha>` e `git push origin "<projeto>@<versão>"`.
- **GitHub Release**: recrie com `gh release create "<projeto>@<versão>" --notes-file <pasta-do-projeto>/CHANGELOG.md`.
- **Versão excluída do registry**: o GitHub restaura um pacote ou versão em até 30 dias, se o nome e a versão não foram reaproveitados. Passo **sem volta** depois disso, e versão pública com mais de 5.000 downloads **não pode** ser excluída (o GitHub exige contato com o suporte).
- **`npm deprecate`**: desfaz com mensagem vazia, `npm deprecate "<pacote>@<versão>" ""`, se o registry o aceitou.

## Problemas conhecidos

| Sintoma                                           | Causa provável                                               | O que fazer                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Reexecutar o job não faz nada                     | O commit e as tags do release já existem                     | Publique à parte (passo 2)                                                           |
| `403` ou `409` no `nx release publish`            | A versão já está no registry                                 | Limite `--projects` aos que faltam; para trocar o conteúdo, publique uma versão nova |
| `gh release delete` não acha a Release            | Nome da tag com `@` sem aspas, ou a Release nunca foi criada | Confira com `gh release list` e cite a tag entre aspas; sem Release, apague só a tag |
| A tag continua no remoto depois de apagar Release | Faltou `--cleanup-tag`                                       | `git push origin ":refs/tags/<projeto>@<versão>"`                                    |
| O push do revert é recusado                       | A `main` é protegida                                         | Faça o revert por PR, como no passo 3.3, nunca por push direto nem force push        |
| O próximo release pula uma versão                 | Tag apagada, mas o commit de release continua no `main`      | Reverta o commit (passo 3.3)                                                         |

## Escalonamento

Procure o mantenedor do repositório (`mateusmacedo`) pelo canal de PR ou issue do GitHub. Leve o link da execução do workflow `Release`, o passo em que parou, a saída do passo 1 e a hora da falha.

## Histórico

| Data       | Quem         | O que mudou |
| ---------- | ------------ | ----------- |
| 2026-11-14 | mantenedores | Criação.    |
