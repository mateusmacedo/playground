# Setup do ambiente local

Do clone ao painel rodando em `http://localhost:3000`, com o ambiente AWS local ao lado. Tempo estimado: 15 minutos, quase todo de download.

## Pré-requisitos

| Ferramenta               | Versão                | Para quê                                                                                                                                                                                                                                      |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**              | 24                    | Runtime de desenvolvimento e do CI.                                                                                                                                                                                                           |
| **pnpm**                 | 11 (`packageManager`) | Gerenciador de pacotes. A versão exata está no `package.json`.                                                                                                                                                                                |
| **Git**                  | recente               | Hooks do Lefthook rodam a cada commit e push.                                                                                                                                                                                                 |
| **Docker**               | com Compose v2        | Sobe o Floci (ambiente AWS local).                                                                                                                                                                                                            |
| **AWS CLI**              | v2                    | Inspeciona e provisiona recursos no Floci e na AWS.                                                                                                                                                                                           |
| **Go**                   | 1.26 ou superior      | Só para serviços Go (`example-go`): testes e build do binário da Lambda.                                                                                                                                                                      |
| **JDK**                  | 21                    | Só para serviços Java (`example-quarkus`). O Gradle vem pelo wrapper `./gradlew`. O `@nx/gradle` roda o wrapper para montar o grafo do Nx, e por isso o CI instala o JDK 21 em todo job que chama o `nx`. O build nativo exige também Docker. |
| **Serverless Framework** | v4, com login         | Deploy de serviços serverless. A v4 exige `serverless login` ou a variável `SERVERLESS_ACCESS_KEY`.                                                                                                                                           |

Só Node, pnpm e Git são necessários para rodar o painel. Docker, AWS CLI e Serverless entram quando você mexer com serviços e com o ambiente AWS local, e o Go só para os serviços escritos em Go.

Confira:

```bash
node --version      # v24.x
pnpm --version      # 11.x
docker compose version
aws --version
```

## 1. Clonar e instalar

```bash
git clone git@github.com:mateusmacedo/playground.git
cd playground
pnpm install
```

O `pnpm install` também instala os hooks do Git (Lefthook, no `postinstall`) e atualiza o cliente do Nx Cloud. O pnpm 11 bloqueia scripts de ciclo de vida de dependências por padrão; `pnpm-workspace.yaml` libera só os necessários (`allowBuilds`).

## 2. Variáveis de ambiente

```bash
cp apps/backoffice/.env.example apps/backoffice/.env.local
```

Os padrões já servem (`NEXT_PUBLIC_APP_NAME=Backoffice`, `NEXT_PUBLIC_STAGE=local`). Arquivos `.env` e `.env.local` são ignorados pelo git. **Nunca** coloque segredo em variável `NEXT_PUBLIC_*`: elas vão para o bundle do navegador.

## 3. Subir o ambiente AWS local (opcional para o painel)

```bash
pnpm nx up infra-local
```

Detalhes, variáveis e problemas comuns em [Ambiente AWS local com o Floci](./local-aws-floci.md).

## 4. Rodar o painel

```bash
pnpm nx dev backoffice
```

Abra `http://localhost:3000`. Você deve ver o menu lateral com "Início", o cabeçalho com a escolha de tema e o rodapé com `ambiente local`.

## 5. Conferir que está tudo certo

```bash
pnpm nx show projects                    # lista os projetos do workspace
pnpm nx run-many -t lint test            # lint e testes unitários
pnpm nx build backoffice                 # build de produção (checa os tipos)
```

Para o e2e, instale o navegador uma vez:

```bash
pnpm exec playwright install chromium
pnpm nx e2e backoffice-e2e          # só Chromium por padrão; todos os browsers: pnpm e2e:full
```

O e2e sobe o painel sozinho (`nx run backoffice:dev`, ou `backoffice:start` no CI) e reaproveita um servidor que já esteja de pé na porta 3000.

## Editor

O `.vscode/extensions.json` recomenda as extensões do repositório: `biomejs.biome` (formatação e lint), `dbaeumer.vscode-eslint` (as fronteiras do Nx), `ms-playwright.playwright`, `nrwl.angular-console` (Nx) e, para os serviços, `golang.go` (Go), `vscjava.vscode-java-pack`, `vscjava.vscode-gradle` e `redhat.vscode-quarkus` (Java). O `.editorconfig` define UTF-8, LF, 2 espaços e 80 colunas, com tabs em Go e `Makefile` e CRLF só em `*.bat`; o `.gitattributes` mantém o LF no checkout (inclusive do `gradlew`).

## Hooks do Git

O Lefthook (`lefthook.yml`) roda automaticamente:

| Hook         | O que faz                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | Roda o Biome (`biome check --write --staged`) nos arquivos do commit e `gofmt -w` nos `*.go` do commit, e re-adiciona o que eles corrigiram. Java não entra: o Spotless leva 22 a 26 s com a JVM fria. |
| `commit-msg` | Valida a mensagem com o commitlint (Conventional Commits, em inglês).                                                                                                                                  |
| `pre-push`   | Roda `nx affected -t lint typecheck test` contra `origin/main`, com 2 tarefas em paralelo. O `test` de Go e Java entra.                                                                                |

Se um hook falhar, corrija a causa. Não use `--no-verify`.

## Fluxo de trabalho

1. Atualize a `main` e crie a branch: `git switch -c feat/customers-page`. O padrão é `tipo/descricao-curta` (`feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`).
2. Faça as mudanças em commits pequenos, no formato `tipo(scope): descrição`, **em inglês**, no imperativo e em minúsculas. Exemplo: `feat(backoffice): add customers page`.
   - O `scope` é o nome de um projeto Nx (`backoffice`, `backoffice-e2e`, `infra-local`) ou um de `workspace`, `ci`, `deps`, `release`, `docs`, `tooling`, `infra`.
3. Valide: `pnpm nx affected -t lint test typecheck build` e `pnpm format:check`. O atalho `pnpm check` roda o mesmo que o `pre-push`. Se mexeu em Java, rode também `pnpm nx run-many -t spotlessCheck -p example-quarkus example-quarkus-core` (ou corrija com `./gradlew spotlessApply`): o Spotless só roda sozinho no nível completo.
4. Abra o PR **para a `main`**.

## Problemas comuns

| Sintoma                                                               | Causa provável                                                       | O que fazer                                                                                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Erro de sintaxe ou de módulo logo no `pnpm install` ou no `nx`        | Node diferente do 24.                                                | Troque para o Node 24 (`fnm use 24`, `nvm use 24` ou equivalente).                                                                                       |
| `pnpm: command not found`, ou versão diferente da do `packageManager` | pnpm ausente ou desatualizado.                                       | Instale o pnpm 11; ele respeita o campo `packageManager`.                                                                                                |
| `Port 3000 is already in use`                                         | Outro processo na porta.                                             | Pare o outro processo, ou use outra porta: `PORT=3001 pnpm nx dev backoffice`. O e2e espera a 3000.                                                      |
| Dev server responde 403 em `/_next/*`                                 | Você abriu o painel por um host que não está em `allowedDevOrigins`. | Use `localhost` ou `127.0.0.1`, ou acrescente o host em `apps/backoffice/next.config.js` ([ADR 0006](../adr/0006-next-16-4-6-e-allowed-dev-origins.md)). |
| Cache do Nx com resultado estranho                                    | Estado local antigo.                                                 | `pnpm nx reset`.                                                                                                                                         |
| `nx sync:check` falha                                                 | `tsconfig` fora de sincronia com as dependências.                    | `pnpm nx sync` e inclua o resultado no commit.                                                                                                           |
| Hook `commit-msg` rejeita a mensagem                                  | Fora do padrão (idioma, tempo verbal, scope).                        | Leia o erro do commitlint; ajuste e recomite.                                                                                                            |
| `playwright` pede o navegador                                         | Navegadores não instalados.                                          | `pnpm exec playwright install chromium`.                                                                                                                 |

## Próximos passos

- [Criar uma página no backoffice](../guides/backoffice-nova-pagina.md)
- [Tarefas do Nx](../guides/nx-tarefas.md)
- [Visão de arquitetura](../architecture/overview.md)
