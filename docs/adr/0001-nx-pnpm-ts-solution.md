# ADR 0001: Nx 24 com pnpm no setup TypeScript solution

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O repositório é um monorepo poliglota em construção: apps web (Next.js hoje, Angular planejado), serviços serverless em TypeScript, Go e Java, e infraestrutura. Precisamos de um orquestrador de tarefas com cache e grafo de dependências, e de um jeito de uma lib TypeScript ser consumida por outros projetos sem gambiarras de caminho.

O Nx 24 oferece dois jeitos de ligar projetos TypeScript:

- **Path aliases**: `paths` no `tsconfig.base.json` apontando para o código-fonte de cada lib.
- **TypeScript solution**: workspaces do gerenciador de pacotes + project references. Cada projeto é um pacote de verdade, e o `tsc` e o bundler resolvem as dependências como resolveriam um pacote npm.

## Decisão

- **Nx 24.0.0**, conectado ao Nx Cloud (`nxCloudId` no `nx.json`), com plugins que **inferem** os targets (`@nx/next`, `@nx/eslint`, `@nx/vitest`, `@nx/playwright` e `@nx/js/typescript`).
- **pnpm 11** com workspaces (`packages/*` e `apps/*` em `pnpm-workspace.yaml`). A versão exata fica em `packageManager` no `package.json`; o `pnpm/action-setup` do CI usa essa versão.
- **TypeScript 6.0 no setup TS solution**: `tsconfig.base.json` com `composite` e `customConditions: ["@org/source"]`; o `tsconfig.json` da raiz lista as `references`; cada projeto tem o próprio `tsconfig`. O `nx sync` mantém essas referências, e o CI roda `nx sync:check`.
- **Node 24** como runtime de desenvolvimento e de CI.
- Versões compartilhadas ficam no catálogo do pnpm (`catalog:` em `pnpm-workspace.yaml`), para atualizar `nx`, `@nx/*` e `typescript` em um lugar só.

Ficou de fora o setup por path aliases: ele esconde dependências entre projetos atrás de caminhos do `tsconfig` e o `package.json` deixa de dizer a verdade sobre quem usa quem.

## Consequências

- **Ganhos**: dependência entre projetos é explícita no `package.json` e no grafo do Nx; o editor, o `tsc` e o bundler resolvem libs do mesmo jeito; cache do Nx e `nx affected` funcionam sem configuração manual.
- **Custos**: plugins e geradores que ainda assumem path aliases não funcionam como estão. O primeiro caso é o Angular, tratado no [ADR 0005](./0005-angular-no-setup-ts-solution.md).
- **Regra de trabalho**: lib nova é criada pelo gerador do Nx (skill `nx-generate`) e ligada por `pnpm`, sem editar `paths` à mão.
- **Gatilho de revisão**: se mais de um framework planejado exigir path aliases, reavaliar o setup.
