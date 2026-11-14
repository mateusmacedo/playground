# ADR 0007: Lint e formatação híbridos, Biome e ESLint mínimo

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O workspace nasceu com ESLint (regras de TypeScript, React, Next e Playwright) e Prettier. Dois problemas apareceram:

- **Custo**: o ESLint com seus plugins é lento perto de um linter nativo, e a configuração se espalhava por vários arquivos e plugins. O repositório roda `lint` no pre-push, no CI de PR e no release, e a máquina de CI tem 4 vCPU.
- **Fronteiras do Nx**: a regra `@nx/enforce-module-boundaries` precisa do grafo de projetos do workspace, e nenhum outro linter a oferece.

Uma versão anterior desta decisão mantinha o Prettier para SCSS, Markdown e YAML. O Biome 2.6.7 passou a formatar também esses formatos (segundo o anúncio do Biome 2.6, o YAML é 100% compatível com a suíte de testes do Prettier, o Markdown cerca de 92% e o SCSS acima de 90%), e o Prettier foi **removido**.

## Decisão

Adotar um modelo **híbrido**, com o Biome como ferramenta principal e o ESLint reduzido ao que o Biome não faz.

### Biome 2.6.7, na raiz (`biome.json`)

- **Formata** JS, TS, JSON, CSS, SCSS, YAML e Markdown, e **linta** JS, TS, JSON e CSS.
- Organiza imports (`assist.actions.source.organizeImports`).
- `linter.rules.preset: "recommended"`, com os domínios `next`, `react`, `test` e `playwright`, e `suspicious.noImportCycles` como erro.
- Estilo: aspas simples, 2 espaços, 80 colunas, ponto e vírgula e vírgula final.
- `vcs` habilitado, com `defaultBranch: main` e respeito ao `.gitignore`.

### ESLint mínimo

- Só a regra `@nx/enforce-module-boundaries`, para as fronteiras por tags do Nx.
- O target `lint` do Nx continua existindo (inferido pelo `@nx/eslint/plugin`) e roda só isso.
- Quando o **Angular** chegar ([ADR 0005](./0005-angular-no-setup-ts-solution.md)), entra o `angular-eslint` para os templates.

### Comandos

| Para quê                     | Comando                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| Corrigir formatação e lint   | `pnpm format` (`biome check --write .`)                           |
| Verificar (CI)               | `pnpm format:check` (`biome ci .`)                                |
| Biome e fronteiras do Nx     | `pnpm lint` (`biome lint .` e `nx run-many -t lint`)              |
| Só as fronteiras, no afetado | `pnpm nx affected -t lint`                                        |
| `pre-commit`                 | `biome check --write --staged --no-errors-on-unmatched`           |
| Job Format do CI, em PR      | `biome ci --changed --since=origin/main --no-errors-on-unmatched` |

## Por que assim

- **Velocidade e configuração única**: um binário, um `biome.json`, sem a cadeia de plugins do ESLint.
- **O Biome não cobre as fronteiras do Nx**: elas dependem do grafo do workspace. Por isso o ESLint fica.
- **O Biome não cobre templates Angular**: ele só tem suporte experimental a Vue, Svelte e Astro. O Angular continua precisando do `angular-eslint`.
- **O `nx format` só reconhece Prettier e oxfmt**: com o Prettier removido, `pnpm nx format:check` e `format:write` **não funcionam** ("No formatter configured"). Os scripts da raiz os substituem.

## Consequências

- **Ganhos**: lint e formatação em milissegundos no hook e no CI; um arquivo de configuração; `noImportCycles` impede ciclos de import.
- **Custos**: dois linters convivem, e o `pnpm lint` roda os dois. A formatação de Markdown e SCSS não é idêntica à do Prettier (compatibilidade de cerca de 92% e acima de 90%), então a migração pode gerar diffs de estilo em arquivos antigos.
- **Go e Java ficam de fora do Biome**: o Go usa o `gofmt` (`pre-commit` e job `format` do CI) e o Java usa o Spotless (só no nível completo, `release.yml` e `pnpm check:full`).
- **Regra de trabalho**: nenhum `nx format`; use `pnpm format` e `pnpm format:check`. Regra de lint de TypeScript, React, Next ou Playwright é do Biome (`biome.json`), e não do ESLint.
- **Gatilho de revisão**: o Angular entrar no repositório (acrescenta o `angular-eslint`), o Biome ganhar uma regra de fronteiras por projeto, ou o `nx format` passar a reconhecer o Biome.
