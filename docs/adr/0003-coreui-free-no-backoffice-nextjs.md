# ADR 0003: CoreUI Free 5.x no backoffice Next.js

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O `apps/backoffice` é o painel administrativo. Já existe um backoffice em Angular, usado como referência, que também usa o CoreUI. Queremos que o painel do Next.js tenha a mesma cara e a mesma estrutura de shell (menu lateral, cabeçalho com tema, breadcrumb, rodapé), para que as telas migrem entre os dois sem redesenho.

A linha 6 do CoreUI só existe, até aqui, como **PRO em alpha**, que exige licença comercial e ainda não é estável. A linha **5.x Free** é estável, tem pacote React (`@coreui/react`) e é a base do template gratuito.

## Decisão

- Usar **CoreUI Free 5.x** (`@coreui/coreui`, `@coreui/react`, `@coreui/icons`, `@coreui/icons-react`) com `simplebar-react` para a rolagem do menu, em versões exatas no `apps/backoffice/package.json`.
- **Espelhar o backoffice Angular de referência** no shell: o menu declarativo (`src/layout/nav.ts`), os títulos de breadcrumb (`src/layout/routes.ts`) e o tema claro, escuro e automático seguem o mesmo desenho.
- Manter o shell em `src/layout`, a UI reutilizável em `src/shared/ui` (estados, toast e `ConfirmModal`) e a sessão provisória em `src/core/session`, atrás de um contrato (`Session`) que a futura integração de login preenche.
- Não usar nenhum componente PRO do CoreUI. Se uma tela precisar de um, vira decisão nova, com licença.

## Consequências

- **Ganhos**: aparência e comportamento iguais aos do backoffice Angular; CoreUI Free não exige licença; o shell é pequeno e fácil de estender (veja o [guia de página nova](../guides/backoffice-nova-pagina.md)).
- **Custos**: ficamos na linha 5.x. Quando o CoreUI 6 tiver versão estável e gratuita, a migração é um ADR novo.
- **Atenção**: o CoreUI mexe no DOM no cliente. Por isso o shell é `'use client'` e o tema é aplicado por um script antes da hidratação (`themeBootstrapScript`), evitando o flash de tema claro.
- **Gatilho de revisão**: lançamento estável do CoreUI 6 Free, ou necessidade de um componente que só exista no PRO.
