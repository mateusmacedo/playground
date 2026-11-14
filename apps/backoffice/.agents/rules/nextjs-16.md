---
paths:
  - "src/**"
  - "next.config.*"
---

# Next.js 16.4 no backoffice

Leia o guia em `node_modules/next/dist/docs/` (a partir de `apps/backoffice/`) antes de escrever código; na dúvida, Context7 `/vercel/next.js/v16.4.5`. A versão instalada é a 16.4.6.

Nos caminhos abaixo, relativos a `dist/docs/`: **V16** é `01-app/02-guides/upgrading/version-16.md`, **CFG** é `01-app/03-api-reference/05-config/01-next-config-js/`, **FN** é `01-app/03-api-reference/04-functions/` e **FC** é `01-app/03-api-reference/03-file-conventions/`.

## Modelo vigente: Cache Components com Partial Prefetching

O `next.config.js` liga `cacheComponents: true` e `partialPrefetching: true` (CFG `cacheComponents.md` e `partialPrefetching.md`). Todo dado é dinâmico por padrão e cada rota é prerenderizada como uma casca estática. Guias: `01-app/01-getting-started/08-caching.md` e `01-app/02-guides/migrating-to-cache-components.md`.

- **Dado por requisição** (`cookies()`, `headers()`, `searchParams`, `connection()`), tempo atual (`Date.now()`, `new Date()`) e valor aleatório (`Math.random()`, `crypto.randomUUID()`) ficam dentro de `<Suspense>`; sem a fronteira, o dev overlay acusa _blocking-route_. Tempo e aleatório por requisição pedem `connection()` antes (`08-caching.md`).
- **Dado cacheável**: `'use cache'` com `cacheLife` sempre explícito e `cacheTag` (`01-app/03-api-reference/01-directives/use-cache.md`; FN `cacheLife.md` e `cacheTag.md`). Não leia `cookies()` nem `headers()` no escopo cacheado: leia fora e passe como argumento serializável.
- **Proibido**: `export const dynamic`, `revalidate` e `fetchCache` (o build falha com eles; `migrating-to-cache-components.md`) e o `runtime` de segmento (Cache Components exige Node.js; CFG `cacheComponents.md`).
- **Invalidação**: `updateTag(tag)` só em Server Action, quando a tela precisa ler a própria escrita; `revalidateTag(tag, 'max')` (stale-while-revalidate) em Server Function ou Route Handler (FN `updateTag.md` e `revalidateTag.md`).
- **Prefetch**: o `<Link>` busca só a casca (App Shell) da rota; `prefetch={true}` no link busca também os dados da URL dele. Rota que lê `cookies()` ou `headers()` tem casca por sessão (CFG `partialPrefetching.md`; `01-app/03-api-reference/02-components/link.md`).
- **Conferência**: a tabela de rotas do `pnpm nx build backoffice`. `○` é estática, `◐` é casca prerenderizada com o resto sob demanda e `ƒ` é dinâmica; numa página, `ƒ` indica que o build aceitou uma casca vazia (`01-app/02-guides/building.md`). Hoje `/`, `/_not-found` e `/sem-acesso` saem `○`.

## O que o modelo escreve errado

| Errado (até a 15)                                                       | Certo na 16.4                                                                                                                                                         | Doc                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `middleware.ts` com `export function middleware`                        | `proxy.ts` com `export function proxy`, só no runtime `nodejs` (declarar `runtime` no arquivo dá erro). O `middleware` ficou depreciado, não removido                 | V16; FC `proxy.md`                        |
| `skipMiddlewareUrlNormalize`                                            | `skipProxyUrlNormalize`                                                                                                                                               | V16; CFG `skipProxyUrlNormalize.md`       |
| `params`, `searchParams`, `cookies()`, `headers()` e `draftMode()` síncronos | Sempre com `await` (também em `route.js` e `default.js`). Tipos `PageProps<'/rota'>`, `LayoutProps` e `RouteContext` gerados por `next typegen`                   | V16; FC `page.md` e `layout.md`           |
| `experimental.dynamicIO`, `experimental.ppr`, `experimental.useCache`   | `cacheComponents: true` no topo do config, já ligado aqui com `partialPrefetching: true` (desde a 16.3, exige `cacheComponents`)                                        | V16; CFG `cacheComponents.md`             |
| `unstable_cache`, `unstable_noStore`                                    | `'use cache'` com `cacheLife` e `cacheTag` (o `unstable_cache` ainda funciona, mas não entra em código novo); `unstable_noStore` vira `connection()` de `next/server`   | `migrating-to-cache-components.md`; FN `connection.md` |
| `revalidateTag('x')`                                                    | `revalidateTag('x', 'max')` (a forma de um argumento dá erro de tipo); `updateTag` só em Server Action; `refresh()` de `next/cache` em Server Action                   | V16                                       |
| `next dev --turbopack`                                                  | Turbopack é o padrão. Com config de `webpack` customizada o `next build` falha: use `--webpack`                                                                       | V16                                       |
| `next lint` e a opção `eslint` do config                                | Removidos. Aqui o lint é do Biome ([ADR 0007](../../../../docs/adr/0007-lint-e-formatacao-biome-eslint-minimo.md))                                                     | V16                                       |
| `images.domains` e `next/legacy/image`                                  | `images.remotePatterns` e `next/image`. Padrões novos: `qualities: [75]`, `minimumCacheTTL` de 14400 s (4 h), imagem local com query exige `images.localPatterns.search` | V16; `01-app/03-api-reference/02-components/image.md` |
| AMP, `serverRuntimeConfig` e `publicRuntimeConfig`                      | Removidos. Use variável de ambiente lida por `src/core/config/app-config.ts`                                                                                          | V16                                       |
| Slot de rota paralela sem `default.js`                                  | `default.js` explícito, que pode chamar `notFound()` ou retornar `null`; sem ele o build falha                                                                        | V16                                       |
| `experimental.reactCompiler`                                            | `reactCompiler` no topo do config: estável e desligado por padrão                                                                                                     | V16; CFG `reactCompiler.md`               |
| `unstable_catchError` e `unstable_retry`                                | `import { catchError } from 'next/error'`; `retry` chega como prop em `error.js` e no segundo argumento do fallback do `catchError`. `reset()` ainda existe            | FN `catchError.md`; FC `error.md`         |

## Ferramentas

- MCP `next-devtools` (`.mcp.json` da raiz): só responde com `pnpm nx dev backoffice` rodando, porque usa o endpoint `/_next/mcp` do servidor de desenvolvimento (`01-app/02-guides/mcp.md`).
- Não rode `@next/codemod agents-md`: é legado, e o `next dev` mantém o bloco gerenciado do `AGENTS.md`.
