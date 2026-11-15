---
name: skill-react-component-structure
description: >-
  Onde colocar e como nomear componentes, hooks, contextos, testes e estilos em `apps/backoffice/src` (Next.js App Router com CoreUI): `app/`, `layout/`, `shared/ui`, `shared/hooks`, `core/`, arquivos em kebab-case, `*.spec.ts(x)` ao lado do código e o passo a passo de uma página nova (`src/app/(painel)/<rota>`, `layout/nav.ts` e `layout/routes.ts`). Use ao criar, mover ou renomear componente, hook, provider ou página do painel. NÃO usar para decisões de React como Server ou Client Component e effects (use skill-react-best-practices) nem para criar projeto novo (use nx-generate).
---

# Estrutura de componentes no backoffice

Raiz: `apps/backoffice/src`, com o alias `@/` apontando para ela. O quadro completo está no [`README`](../../../README.md) do app; convenções gerais (Biome, PT-BR, validação) no [`AGENTS.md`](../../../../../AGENTS.md). Esta skill responde **onde** o arquivo mora e **como** se chama.

## Mapa

```text
src/
├── app/                      # só roteamento (App Router)
│   ├── layout.tsx            # raiz: <html lang="pt-BR">, tema, estilos, providers
│   ├── providers.tsx         # SessionProvider + ToastProvider
│   ├── not-found.tsx         # 404 sem o shell
│   └── (painel)/             # grupo que ganha o shell; o parêntese não entra na URL
│       ├── layout.tsx        # envolve as páginas no DefaultLayout
│       ├── page.tsx          # /
│       └── sem-acesso/page.tsx
├── layout/                   # shell: menu, cabeçalho, breadcrumb, rodapé, tema
├── shared/
│   ├── ui/                   # UI reutilizável, sem regra de negócio
│   └── hooks/                # hooks reutilizáveis
├── core/                     # config pública e sessão (contrato + provider)
├── icons/                    # marca no formato do CoreUI
└── scss/                     # estilos do CoreUI, tema e ajustes
```

## Onde colocar

| O que é                                                  | Onde                                         | Exemplo real                                  |
| -------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Rota, layout de segmento, 404                            | `src/app/...`                                | `app/(painel)/sem-acesso/page.tsx`            |
| Componente usado por uma única página                    | pasta da rota, ao lado da `page.tsx`         | guia: `clientes/customers-list.tsx`           |
| UI usada por 2+ telas, sem regra de negócio              | `src/shared/ui/<nome>.tsx`                   | `confirm-modal.tsx`, `states.tsx`, `toast.tsx` |
| Hook reutilizável                                        | `src/shared/hooks/use-<nome>.ts`             | `use-is-client.ts`                            |
| Peça do shell (menu, cabeçalho, rodapé, breadcrumb)      | `src/layout/app-<nome>.tsx`                  | `app-sidebar.tsx`, `app-header.tsx`           |
| Dado e regra do shell, sem JSX                           | `src/layout/<nome>.ts`                       | `nav.ts`, `routes.ts`, `breadcrumbs.ts`       |
| Config pública, sessão, contrato transversal             | `src/core/<tema>/`                           | `config/app-config.ts`, `session/session.ts`  |
| Estado compartilhado de uma área                         | `<área>-context.tsx` (provider + hook)       | `layout/shell-context.tsx`                    |
| Ajuste global de CSS                                     | `src/scss/_custom.scss`, com `WHY:`          | `.skip-link`, `.table-responsive`             |

**Colocalize primeiro.** O código de uma tela fica na pasta da rota; só sobe para `shared/` quando uma segunda tela precisar. Arquivo dentro de `app/` que não seja `page`, `layout`, `route` etc. **não vira rota**, então a colocalização é segura. Pasta com `_` na frente (`_components`) também é privada, mas o repo ainda não usa.

**Sentido das dependências** (observado no código atual): `app` usa `layout`, `shared`, `core` e `icons`; `layout` usa `shared`, `core` e `icons`; `shared` não importa de `app` nem de `layout`; `core` não importa de nenhum deles. O Biome falha em ciclo de import (`noImportCycles`).

## Nomes

| Item                  | Regra                                                         | Exemplo                                |
| --------------------- | ------------------------------------------------------------- | -------------------------------------- |
| Arquivo               | kebab-case, em inglês                                         | `confirm-modal.tsx`                    |
| Componente e tipo     | PascalCase, **export nomeado**                                | `ConfirmModal`, `ConfirmModalProps`    |
| Hook                  | arquivo `use-<nome>.ts`, função `useNome`                     | `use-is-client.ts`                     |
| Contexto              | `<área>-context.tsx` com `XProvider` e `useX`                 | `session-context.tsx`                  |
| Teste                 | `<arquivo>.spec.ts(x)`, ao lado do código                     | `nav.spec.ts`                          |
| Pasta de rota         | segmento da URL (hoje em PT-BR), minúsculo com hífen          | `sem-acesso`                           |
| Grupo de rota         | `(nome)`                                                      | `(painel)`                             |

- `export default` só nos arquivos especiais do Next (`page`, `layout`, `not-found`; também `error` e `loading` quando existirem). Todo o resto é export nomeado.
- **Sem barrel** (`index.ts`): o repo não tem nenhum; mantenha assim e importe pelo arquivo (`@/shared/ui/states`). Reexport facilita ciclo de import (o Biome falha neles) e esconde o que entra no bundle de cliente.
- Componentes pequenos e coesos podem dividir um arquivo (`states.tsx` guarda `EmptyState`, `ErrorState` e `LoadingState`). Componente que cresce ganha arquivo próprio.
- Import relativo **sem sufixo** (`'./nav'`): o backoffice usa `moduleResolution: bundler`. O sufixo `.js` é regra dos serviços em `apps/services`, não daqui.
- Arquivos e identificadores em inglês, mesmo quando a URL é PT-BR (`/clientes` com `customers-list.tsx`). O exemplo do guia de página nova nomeia arquivos em português; vale a regra do `AGENTS.md`.

## Anatomia de um componente

Modelo real, `shared/ui/states.tsx`: arquivo com `'use client'` quando usa CoreUI interativo ou hook, props pequenas inline em `Readonly<{...}>`, TSDoc em PT-BR só para o contrato que não é óbvio.

```tsx
'use client';

import type { ReactNode } from 'react';

/** Lista ou página sem dados: o texto e, como filhos, a ação. */
export function EmptyState({
  message,
  children,
}: Readonly<{ message: string; children?: ReactNode }>) {
  return (
    <div className="text-center text-body-secondary py-5">
      <p className="mb-2">{message}</p>
      {children}
    </div>
  );
}
```

- Props usadas por outros arquivos viram `export interface XProps` com campos `readonly`, como `ConfirmModalProps`.
- `'use client'` fica no arquivo de **entrada** interativo. Arquivo de lógica pura (`nav.ts`, `routes.ts`, `breadcrumbs.ts`) e hook importado só por componente de cliente não levam a diretiva. A decisão em si está em `skill-react-best-practices`.
- Contexto: `createContext<T | null>(null)`, provider com valor memoizado e hook que lança erro fora do provider (`useSession`, `useShell`, `useToast`). Provider do app inteiro entra em `app/providers.tsx`; o de uma área fica perto dela (`ShellProvider` dentro do `DefaultLayout`).

## Estilos

- Classes utilitárias do Bootstrap/CoreUI no `className` (`card`, `d-flex`, `text-body-secondary`) e as props do componente CoreUI (`color`, `size`, `variant`). Variação por prop mapeia para a prop do CoreUI, não para classe montada à mão.
- Ajuste global vai em `src/scss/_custom.scss`, com comentário `WHY:`. Hoje não há CSS Modules no repo: prefira as classes utilitárias.
- Não há Tailwind, shadcn nem helper `cn()`. Para classe condicional, use template string simples.

## Testes

`*.spec.ts(x)` ao lado do código, Vitest com `describe`, `it` e `expect` globais. Regra de tela que dá para isolar vira função em `.ts` sem JSX, testada sem DOM (`nav.ts` com `nav.spec.ts`). Fluxo de tela vai no e2e em `apps/backoffice-e2e/src`. Teste de componente: [`skill-react-best-practices`](../skill-react-best-practices/references/formularios-e-testes.md).

## Página nova: três lugares

Resumo do [guia](../../../../../docs/guides/backoffice-nova-pagina.md), que tem o exemplo completo.

| Passo | Arquivo                                   | O que fazer                                                                                           |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1     | `src/app/(painel)/<rota>/page.tsx`        | Componente de servidor com `export const metadata = { title }` (vira "Título · Backoffice" na aba)    |
| 2     | `src/app/(painel)/<rota>/<nome>.tsx`      | Parte interativa em arquivo irmão com `'use client'`                                                  |
| 3     | `src/layout/nav.ts`                       | Item em `navItems` (`link`, `group` ou `title`), com `permission: '<recurso>:<ação>'` se for restrito |
| 4     | `src/layout/routes.ts`                    | Título do breadcrumb em `routeTitles` (`'/clientes'`, `'/clientes/:id'`)                              |
| 5     | `*.spec.ts` ao lado                       | Teste da regra de negócio da tela; fluxo no e2e                                                       |

- Dentro de `(painel)` a página já recebe menu, cabeçalho e rodapé.
- **O menu só esconde o item; não protege a rota.** Quem digitar a URL chega à página. Autorização de verdade é do servidor (`AGENTS.md`); na interface, confira `useSession().permissions` e mostre `ErrorState` ou vá para `/sem-acesso`.
- Reaproveite `@/shared/ui/states`, `useToast()` e `ConfirmModal` antes de criar algo novo.

## Checklist

- [ ] Arquivo no lugar certo (rota, `shared/`, `layout/` ou `core/`), colocalizado até haver 2+ usos.
- [ ] Nome em kebab-case e inglês; export nomeado (default só em arquivo especial do Next).
- [ ] Sem `index.ts` de reexport; import pelo arquivo, sem sufixo `.js`.
- [ ] `'use client'` só onde há interação; lógica pura em `.ts` sem diretiva.
- [ ] Teste `*.spec.ts(x)` ao lado do código; fluxo no e2e.
- [ ] Página nova: rota, `nav.ts` e `routes.ts` atualizados.
- [ ] Sem ciclo de import: `shared` e `core` não dependem de `app` nem de `layout`.

Veja também: [`docs/guides/backoffice-nova-pagina.md`](../../../../../docs/guides/backoffice-nova-pagina.md), [ADR 0003](../../../../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md), [`apps/backoffice/README.md`](../../../README.md).
