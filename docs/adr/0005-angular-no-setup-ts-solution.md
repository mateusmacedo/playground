# ADR 0005: Angular no setup TypeScript solution

- **Status**: Proposto
- **Data**: 2026-11-14

## Contexto

O plano é ter apps Angular no monorepo, ao lado do backoffice em Next.js. O workspace usa o setup **TypeScript solution** ([ADR 0001](./0001-nx-pnpm-ts-solution.md)), e o Nx 24 **bloqueia o `@nx/angular` nesse setup**: o plugin não suporta o workspace com project references, e os geradores se recusam a rodar nele.

O Nx documenta uma variável de ambiente para continuar mesmo assim, a `NX_IGNORE_UNSUPPORTED_TS_SETUP=true`, com o aviso de que se trata de uma saída de emergência e de que o risco de incompatibilidade passa a ser nosso.

## Opções

| Opção                            | Como fica                                                                                       | Prós                                               | Contras                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. Path aliases no workspace** | Abandonar o TS solution e voltar a `paths` no `tsconfig.base.json`.                             | Suporte pleno do `@nx/angular`.                    | Perde o desenho do ADR 0001 para tudo, inclusive o que já funciona; retrabalho no backoffice.   |
| **B. Workspace separado**        | Angular em um repositório (ou workspace Nx) próprio, com o próprio setup.                       | Cada stack no setup que ela suporta.               | Duas esteiras de CI, duas configurações, e nada de compartilhar libs TypeScript.                |
| **C. Variável de escape**        | Manter o TS solution e rodar os geradores do Angular com `NX_IGNORE_UNSUPPORTED_TS_SETUP=true`. | Nenhuma migração; o resto do repositório não muda. | Combinação sem suporte oficial: builds, geradores e migrações futuras do Angular podem quebrar. |

## Decisão

**Em aberto.** Recomendação inicial: começar pela opção **C** em um app Angular descartável, só para medir o que quebra (build, testes, lint, `nx sync`). Se o experimento passar sem gambiarra, seguir com C; se não, escolher entre A e B com os dados do experimento.

Enquanto o status for `Proposto`, não há app Angular no repositório e nenhuma configuração deve assumir a existência dele.

## Consequências

- **Se C**: documentar a variável no onboarding e fixar a versão do `@nx/angular` junto com a do `nx`; cada atualização do Nx exige rodar o experimento de novo.
- **Se A**: criar ADR que substitui o 0001 e migrar o backoffice para path aliases.
- **Se B**: o repositório permanece só com as stacks que suportam TS solution.
- **Gatilho de revisão**: o `@nx/angular` passar a suportar TS solution, o que torna as três opções desnecessárias.
