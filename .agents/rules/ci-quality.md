---
paths:
  - "biome.json"
  - "lefthook.yml"
  - "commitlint.config.mjs"
  - "nx.json"
  - "package.json"
  - "pnpm-workspace.yaml"
  - "renovate.json"
  - "tsconfig*.json"
  - ".github/**"
---

# CI e qualidade

Os arquivos executáveis (`package.json`, `nx.json`, `lefthook.yml`, `commitlint.config.mjs`, `.github/workflows/*.yml`) prevalecem sobre esta prosa. Em dúvida, leia o arquivo. Commits, branch, hooks, pinning de actions, catálogo do pnpm e a política de CI estão no `AGENTS.md` da raiz ("Git", "Comandos de validação" e "CI e dependências").

## Ferramentas

| Categoria         | Ferramenta                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Lint e formatação | **Biome** em tudo (`biome.json`). Não existe Prettier.                                                        |
| Lint do Nx        | ESLint só com `@nx/enforce-module-boundaries` (target `lint` inferido)                                        |
| Tipos             | TypeScript estrito (`typecheck`); no painel, o `next build` checa os tipos                                    |
| Testes unitários  | Vitest, o único runner de TypeScript                                                                          |
| E2E               | Playwright (`backoffice-e2e`), Chromium por padrão                                                            |
| Go                | `go test` e `go build` pelos targets do Nx; `gofmt -l .` e `go vet ./...` na pasta do serviço (não há target) |
| Instruções de IA  | `node tools/ai/check-instructions.mjs` ([ADR 0012](../../docs/adr/0012-instrucoes-de-ia-por-projeto.md))      |
| Gerenciador       | pnpm 11; tarefas sempre pelo Nx (`pnpm nx ...`), nunca a ferramenta por baixo                                 |

## Rápido por padrão, completo no release

| Onde                 | O que roda                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit`         | `biome check --write --staged` nos arquivos do commit                                                                         |
| `commit-msg`         | `commitlint` (Conventional Commits em inglês)                                                                                 |
| `pre-push`           | `nx affected -t lint typecheck test` (sem build nem e2e)                                                                      |
| `ci.yml` (PR e main) | `biome ci` (no PR, só nos alterados), `nx sync:check`, `nx affected -t lint typecheck test build`, e2e no Chromium se afetado |
| `release.yml`        | tudo, com coverage e e2e em todos os browsers                                                                                 |
| `sonar.yml`          | SonarQube Cloud com cobertura (no PR, só os afetados; semanal e manual na main), fora dos checks do PR (ADR 0013)              |

- Use `nx affected` no dia a dia. `nx run-many` é para o release e para validar uma mudança que toca a configuração do workspace.
- Terraform: os `infra-local-*` têm `fmt`, `validate`, `lint` (tflint com o `.tflint.hcl` da raiz) e `test` (o `terraform test` dos módulos que cada env usa), com cache, e entram no `nx affected` como os outros projetos; pedem `terraform` e `tflint` na máquina. `init`, `plan`, `apply`, `destroy` e `smoke` não usam cache ([`infra/terraform`](../../infra/terraform/README.md), [ADR 0011](../../docs/adr/0011-estrutura-profissional-do-terraform.md)).
- Cobertura só quando pedida (`VITEST_COVERAGE=1` ou `pnpm check:full`); com ela ligada, cada projeto reprova abaixo de 90% em linhas ou ramos (rule `testing-conventions`).
