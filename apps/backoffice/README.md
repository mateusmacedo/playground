# Backoffice

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground) [Métricas desta pasta no SonarQube Cloud](https://sonarcloud.io/code?id=mateusmacedo_playground&selected=mateusmacedo_playground%3Aapps%2Fbackoffice)

Painel administrativo em **Next.js 16** (App Router) e **React 19**, com o shell do **CoreUI Free 5.x**: menu lateral filtrado por permissão, cabeçalho com tema claro, escuro e automático, breadcrumb e rodapé com o ambiente. As decisões por trás estão nos ADRs [0003](../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md) e [0006](../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md).

Projeto Nx `backoffice`, com tags `scope:backoffice` e `type:app`. Os testes de ponta a ponta ficam em [`apps/backoffice-e2e`](../backoffice-e2e).

## Comandos

Todos pela raiz do repositório, via Nx:

```bash
pnpm nx dev backoffice          # servidor de desenvolvimento em http://localhost:3000
pnpm nx build backoffice        # next build (gera o artefato standalone)
pnpm nx start backoffice        # next start, depois do build
pnpm nx lint backoffice         # fronteiras do Nx (ESLint mínimo)
pnpm format:check                # Biome: formatação e lint do código
pnpm nx test backoffice         # Vitest com jsdom
pnpm nx e2e backoffice-e2e                # Playwright (Chromium por padrão)
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste. O arquivo `.env` é ignorado pelo git.

| Variável               | Padrão       | Descrição                                                                                   |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME` | `Backoffice` | Nome do painel: título da aba, marca do menu e rodapé.                                      |
| `NEXT_PUBLIC_STAGE`    | `local`      | Ambiente exibido no rodapé: `local`, `dev`, `homolog` ou `prod`. Outro valor falha o build. |

Variáveis `NEXT_PUBLIC_*` **entram no bundle do navegador** no build. Nunca coloque segredo nelas. A leitura é feita em um único lugar, `src/core/config/app-config.ts`, que expõe `appConfig` (nome, ambiente e crédito do rodapé) e o enum `AppStage`.

## Estrutura

```text
apps/backoffice/
├── next.config.js            # output standalone, allowedDevOrigins, Sass
├── .env.example
├── public/
└── src/
    ├── app/                  # rotas (App Router)
    │   ├── layout.tsx        # raiz: <html lang="pt-BR">, tema, estilos, providers
    │   ├── providers.tsx     # SessionProvider + ToastProvider
    │   ├── error.tsx         # erro inesperado de uma página, inclusive do painel
    │   ├── global-error.tsx  # erro do próprio layout raiz, com <html> e <body>
    │   ├── error-screen.tsx  # a tela que os dois reaproveitam (só o digest, nunca a mensagem)
    │   ├── not-found.tsx     # 404 fora do painel (sem menu)
    │   └── (painel)/         # grupo de rotas que ganha o shell
    │       ├── layout.tsx    # envolve as páginas no DefaultLayout
    │       ├── page.tsx      # início
    │       ├── quadro/       # quadro kanban: colunas e cards agnósticos, arraste e teclado
    │       └── sem-acesso/   # destino de quem não tem nenhuma permissão
    ├── core/
    │   ├── config/           # configuração pública (NEXT_PUBLIC_*)
    │   └── session/          # contrato Session e SessionProvider provisório
    ├── layout/               # o shell do CoreUI
    │   ├── default-layout.tsx    # menu + cabeçalho + conteúdo + rodapé
    │   ├── nav.ts                # itens do menu e regra de permissão
    │   ├── routes.ts             # títulos do breadcrumb
    │   ├── breadcrumbs.ts        # cálculo da trilha
    │   ├── color-mode.ts         # chave do tema e script anti-flash
    │   └── app-*.tsx             # sidebar, header, breadcrumb, footer
    ├── shared/
    │   ├── ui/               # EmptyState, ErrorState, LoadingState, toast, ConfirmModal
    │   └── hooks/            # useIsClient, useColorMode
    ├── icons/brand.ts        # logo e signet (marca neutra)
    └── scss/                 # estilos do CoreUI, tema e ajustes
```

O alias `@/` aponta para `src/`, no TypeScript e no Vitest.

## Como o shell funciona

- **Layout do painel**: toda página em `src/app/(painel)` passa por `DefaultLayout`. Rotas fora do grupo, como a 404, não têm menu nem cabeçalho.
- **Sessão**: `DefaultLayout` consulta `useSession()` e troca a página pelo estado da sessão enquanto ela não está `ready` (`loading`, `error` e `expired` mostram `LoadingState` ou `ErrorState`; sem `signIn`, a sessão expirada oferece só "Recarregar"). O `error` da sessão é um texto seguro para o usuário.
- **Menu**: `navItems` (em `nav.ts`) é filtrado por `buildNav(items, permissions)`. Item sem `permission` aparece para todos; grupo sem filhos e título sem itens somem.
- **Breadcrumb**: calculado a partir da URL e dos títulos de `routes.ts`. Segmentos `:id` aceitam qualquer valor, e a rota fixa vence a parametrizada.
- **Tema**: o hook `useColorMode` (`shared/hooks`) guarda a escolha no `localStorage` (chave `backoffice-theme`); sem escolha, o tema é automático e segue o sistema. Com o armazenamento bloqueado ou cheio, a escolha vale só na página aberta, sem derrubar o cabeçalho. Um script no `<head>` aplica o tema antes da hidratação para evitar o flash.

## Como estender

| Quero…                            | Onde mexer                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Criar uma página                  | `src/app/(painel)/<rota>/page.tsx`, `nav.ts` e `routes.ts` ([guia](../../docs/guides/backoffice-nova-pagina.md)) |
| Mostrar carregando, vazio ou erro | `LoadingState`, `EmptyState` e `ErrorState` de `@/shared/ui/states`                                              |
| Avisar o usuário                  | `useToast()` de `@/shared/ui/toast` (`success`, `info`, `warning`, `danger`)                                     |
| Pedir confirmação                 | `ConfirmModal` de `@/shared/ui/confirm-modal`                                                                    |
| Ligar o login de verdade          | Passar uma `Session` real em `value` ao `SessionProvider`, em `src/app/providers.tsx`                            |
| Trocar a marca                    | `logo` e `signet` em `src/icons/brand.ts`, mantendo o formato do `@coreui/icons`                                 |
| Ajustar cores e espaçamentos      | `src/scss/_theme.scss` e `src/scss/_custom.scss`                                                                 |
| Adicionar uma variável pública    | `.env.example` e `src/core/config/app-config.ts`                                                                 |

### Sessão provisória

Hoje o `SessionProvider` entrega uma sessão fixa: pronta, com o usuário "Usuário" e **sem permissões**. Itens do menu com `permission` não aparecem, e nada bloqueia o acesso direto a uma URL. O filtro do menu é conveniência de interface, não segurança: a autorização de verdade precisa existir no servidor que serve os dados.

## Testes

- **Unitários** (Vitest + jsdom): arquivos `*.spec.ts` ao lado do código. Hoje cobrem a regra do menu (`nav.spec.ts`) e o cálculo do breadcrumb (`breadcrumbs.spec.ts`).
- **E2E** (Playwright, em `apps/backoffice-e2e`): shell, persistência do tema e página 404. Por padrão roda só o Chromium; `pnpm e2e:full` (`E2E_ALL_BROWSERS=1`) liga Firefox e WebKit. Localmente o servidor de desenvolvimento é acessado por `http://127.0.0.1:3000`; por isso `allowedDevOrigins` inclui esse endereço.

## Build e deploy

`next.config.js` usa `output: 'standalone'` e `outputFileTracingRoot` na raiz do monorepo, para levar as dependências do workspace pnpm junto. Esse é o artefato previsto para a AWS (Lambda ou container). O deploy do backoffice ainda não existe: está no roadmap em [`docs/architecture/overview.md`](../../docs/architecture/overview.md).

## Cuidados com o Next.js

Esta versão do Next.js tem mudanças que o treino de assistentes pode não conhecer. Antes de escrever código novo, leia o guia correspondente em `node_modules/next/dist/docs/`.

O painel usa **Cache Components com Partial Prefetching** (`cacheComponents` e `partialPrefetching` no `next.config.js`). Dado por requisição (`cookies()`, `headers()`, `searchParams`, tempo atual) vai dentro de `<Suspense>`, e dado cacheável vai com `'use cache'`, `cacheLife` e `cacheTag`. A conferência é a tabela de rotas do `pnpm nx build backoffice`: hoje as três rotas saem `○ (Static)`. As convenções completas estão na rule [`nextjs-16`](./.agents/rules/nextjs-16.md).

Para agentes de IA:

- o [`AGENTS.md`](./AGENTS.md) deste projeto traz as instruções do painel e, no fim, o bloco mantido pelo próprio `next dev`; o [`CLAUDE.md`](./CLAUDE.md) só o importa, para o Claude Code;
- a rule [`.agents/rules/nextjs-16.md`](./.agents/rules/nextjs-16.md) lista o que o modelo costuma escrever errado no Next 16.4 e carrega ao mexer em `src/` ou no `next.config.js`;
- o MCP `next-devtools` (`.mcp.json` da raiz, `next-devtools-mcp@0.4.0`) dá ao agente os erros, os logs e as rotas do servidor de desenvolvimento, e por isso exige o `pnpm nx dev backoffice` rodando;
- na dúvida, a documentação da versão está no Context7 (`/vercel/next.js/v16.4.5`).
