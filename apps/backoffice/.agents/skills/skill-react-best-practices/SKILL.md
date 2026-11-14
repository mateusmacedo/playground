---
name: skill-react-best-practices
description: >-
  Decisões e armadilhas de React 19 no `apps/backoffice` (Next.js 16 App Router com CoreUI React 5): Server ou Client Component e `'use client'`, dados com `params` assíncrono e Suspense, estado derivado, effects, memoização sem React Compiler, formulários e Server Actions, acessibilidade e testes com Vitest e Testing Library. Use ao escrever ou revisar componentes, páginas em `src/app` ou código de `src/shared/ui`. NÃO usar para pastas e nomes de arquivo (use skill-react-component-structure) nem para regras que o Biome já aplica.
---

# React no backoffice: decisões e armadilhas

Convenções gerais (Biome, PT-BR, validação ao fim) estão no [`AGENTS.md`](../../../../../AGENTS.md) da raiz, e as do painel (alias `@/`, imports, segredos) no [`AGENTS.md`](../../../AGENTS.md) do backoffice: não se repetem aqui. Esta skill cobre só o que o linter não decide.

## Premissas verificadas no repo

| Item             | Estado                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| React            | 19, versão do catálogo `pnpm-workspace.yaml` (`^19.0.0`); `pnpm ls react` mostra a instalada        |
| Next.js          | `~16.4.6`, App Router, `output: 'standalone'` em `apps/backoffice/next.config.js`                   |
| React Compiler   | **desligado**: sem `reactCompiler` no `next.config.js` e sem `babel-plugin-react-compiler`          |
| Cache Components | **ligado**, com `partialPrefetching`, no `next.config.js` (rule `nextjs-16`)                         |
| UI               | CoreUI Free 5 (`@coreui/react`) e classes utilitárias do Bootstrap/CoreUI em SCSS. Sem Tailwind     |
| Testes           | Vitest com jsdom e `globals: true`, `@testing-library/react`; e2e em Playwright (`backoffice-e2e`) |

Se um destes mudar (por exemplo, ligar o React Compiler), revise as seções 3 e 4.

## Antes de escrever código novo (OBRIGATÓRIO)

O [`apps/backoffice/AGENTS.md`](../../../AGENTS.md) manda ler a doc do Next instalada, porque o 16.4 difere do que os modelos conhecem. Caminhos a partir de `apps/backoffice/node_modules/next/dist/docs/01-app/`:

| Tema                              | Arquivo                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Server x Client, `'use client'`   | `01-getting-started/05-server-and-client-components.md`, `02-guides/server-and-client-boundary.md` |
| Dados e streaming                 | `01-getting-started/06-fetching-data.md`, `02-guides/streaming.md`                                 |
| Cache (Cache Components)          | `01-getting-started/08-caching.md`, `02-guides/migrating-to-cache-components.md`                   |
| `params` e `searchParams`         | `03-api-reference/03-file-conventions/page.md`                                                     |
| Formulários e Server Actions      | `02-guides/forms.md`, `02-guides/server-actions.md`, `02-guides/data-security.md`                  |
| Erros                             | `01-getting-started/10-error-handling.md`, `03-api-reference/03-file-conventions/error.md`         |
| Autenticação e `proxy`            | `02-guides/authentication.md`, `01-getting-started/16-proxy.md`                                    |
| Carregamento sob demanda          | `02-guides/lazy-loading.md`                                                                        |
| Testes                            | `02-guides/testing/vitest.md`                                                                      |

## O que o Biome já barra, e o que não barra

Com a config do repo (domínio `react`), o Biome falha em: componente definido dentro de função (`noComponentHookFactories`), dependências faltando em hook (`useExhaustiveDependencies`), `key` por índice (`noArrayIndexKey`), hook fora do topo e `key` ausente em lista. Não gaste revisão nisso.

O Biome **não** pega: `{count && <X />}` com número, effect que só deriva estado, `'use client'` desnecessário, memoização supérflua, autorização ausente em Server Action. É onde esta skill atua.

## 1. Server ou Client Component

Tudo em `src/app` é Server Component até ter `'use client'`. Escolha pelo que o componente precisa:

| Precisa de                                                      | Tipo    |
| --------------------------------------------------------------- | ------- |
| `useState`, `useEffect`, handlers (`onClick`), `localStorage`   | Client  |
| Hook do CoreUI (`useColorModes`) ou componente interativo `C*`  | Client  |
| `usePathname`, `useSearchParams`, `useRouter` (`next/navigation`) | Client  |
| Buscar dado, ler segredo, `metadata`, reduzir JS                | Server  |

Regras:

- `'use client'` vai na **primeira linha**, antes dos imports, e define uma fronteira: o arquivo e tudo que ele importa entram no bundle do navegador. Marque só o ponto de entrada, não cada arquivo filho.
- Empurre a fronteira para as folhas: a `page.tsx` fica no servidor (é ela que exporta `metadata`) e a parte interativa vai para um arquivo irmão com `'use client'`. Exceção deliberada: o shell (`layout/default-layout.tsx`, `app/providers.tsx`) é todo cliente, porque o CoreUI mexe no DOM ([ADR 0003](../../../../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md)).
- **`@coreui/react` não declara `'use client'`** (confirmado no `dist` do pacote). Componentes `C*` só entram em arquivo com `'use client'`. Página de servidor usa as classes (`card`, `card-body`, `text-body-secondary`), como `src/app/(painel)/page.tsx`.
- Props de servidor para cliente precisam ser **serializáveis**. Handler (`onClick`) não cruza; Server Function (`'use server'`) cruza como referência. Server Component pode entrar em cliente como `children`.
- Provider vai o mais fundo possível na árvore. O `AppProviders` da raiz é aceitável porque sessão e toast valem para o app todo.
- Segredo nunca em `NEXT_PUBLIC_*`; configuração pública só por `src/core/config/app-config.ts`. Módulo que lê segredo do servidor pode importar `server-only` para falhar no build se vazar para o cliente.

```tsx
// src/app/(painel)/clientes/page.tsx  (servidor: sem 'use client')
import type { Metadata } from 'next';
import { CustomersList } from './customers-list';

export const metadata: Metadata = { title: 'Clientes' };

export default function CustomersPage() {
  return (
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="h4">Clientes</h1>
        <CustomersList />
      </div>
    </div>
  );
}
```

O guia [`docs/guides/backoffice-nova-pagina.md`](../../../../../docs/guides/backoffice-nova-pagina.md) mostra o passo a passo completo (rota, menu, breadcrumb, estados).

## 2. Dados, `params` e streaming

- **`params` e `searchParams` são `Promise`.** No Next 16 o acesso síncrono foi removido (também em `cookies()`, `headers()` e `draftMode()`). Use `await` no servidor ou `use()` em página de cliente. Para tipar, `PageProps<'/clientes/[id]'>` é global e vem dos tipos gerados por `next dev` e `next build`.
- Dado por requisição (`cookies()`, `headers()`, `searchParams`) fica dentro de `<Suspense>`; sem a fronteira, o dev overlay acusa _blocking-route_. Numa página, o `ƒ` na tabela de rotas do build indica uma casca vazia aceita. Detalhes na rule `nextjs-16`.
- **Todo dado é dinâmico por padrão** (Cache Components): o `fetch` não é cacheado sozinho. Cache é opt-in com `'use cache'`, com `cacheLife` sempre explícito e `cacheTag`; não leia `cookies()` nem `headers()` dentro do escopo cacheado, passe o valor como argumento. `export const dynamic`, `revalidate` e `fetchCache` são proibidos: o build falha com eles.
- Chamadas independentes em paralelo (`Promise.all`). Dentro do mesmo componente, dois `await` em sequência serializam.
- Dado que não usa `fetch` (SDK, banco) e é lido em vários componentes da mesma requisição: `cache()` do React para deduplicar.
- Conteúdo lento vai em `<Suspense fallback={<LoadingState />}>` ou em `loading.tsx` do segmento. Use o `LoadingState` de `@/shared/ui/states`, que já tem `role="status"` e texto para leitor de tela.
- Na doc do Next, o exemplo de `use()` em cliente passa a **promise** (sem `await`) do servidor para o componente de cliente, dentro de `Suspense`.
- `useSearchParams` em página pré-renderizada exige `<Suspense>` ao redor; sem isso o `next build` falha (em dev parece funcionar).
- Erro esperado (validação, falha de API) é **valor de retorno**, não `throw`. Erro inesperado cai no `error.tsx`, que é Client Component e recebe `retry` (estável desde o Next 16.3, preferível a `reset`). O repo já tem `src/app/error.tsx` e `src/app/global-error.tsx` (só o `digest` vai para a tela, nunca a `message`); ainda não há `loading.tsx`: padrão a seguir.

```tsx
// padrão a seguir: a camada de dados ainda não existe em src/core
import { Suspense } from 'react';

export default async function CustomerPage(props: PageProps<'/clientes/[id]'>) {
  const { id } = await props.params;
  const customer = getCustomer(id); // sem await: inicia cedo
  const orders = getOrders(id);
  return (
    <>
      <CustomerHeader data={await customer} />
      <Suspense fallback={<LoadingState label="Carregando pedidos…" />}>
        <OrdersTable ordersPromise={orders} />
      </Suspense>
    </>
  );
}
```

## 3. Estado e effects

Antes de `useEffect`, pergunte se o valor pode ser calculado. O Biome não avisa de effect desnecessário.

| Situação                                      | Faça                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Valor derivado de props ou estado             | Calcule no render (`const count = items.length`), sem estado extra        |
| Resetar estado quando a identidade muda       | `key={id}` no componente, em vez de effect que chama `setState`           |
| Reagir a clique ou envio                      | Faça no handler, não em effect que observa um flag                        |
| Atualizar a partir do valor anterior          | `setState((prev) => ...)`                                                 |
| Valor inicial caro                            | `useState(() => compute())`                                               |
| Valor transitório que não pinta (timer, drag) | `useRef`                                                                  |
| Callback de effect que lê props sem religar   | `useEffectEvent` (existe no React instalado), em vez de ref manual       |
| Sincronizar com sistema externo               | `useEffect` com limpeza (listener, timer, conexão): é o uso correto       |

```tsx
// Evite: estado extra sincronizado por effect (render a mais, valor defasado)
const [count, setCount] = useState(0);
useEffect(() => {
  setCount(items.length);
}, [items]);

// Prefira: derive no render
const count = items.length;
```

**Hidratação.** O HTML do servidor e o primeiro render do cliente precisam coincidir. Para o que só existe no navegador (tema salvo, `localStorage`, `window`), use o hook do repo `useIsClient` (`@/shared/hooks/use-is-client`, baseado em `useSyncExternalStore`), como faz `layout/app-header.tsx`. `suppressHydrationWarning` fica restrito ao `<html>` do tema; não o espalhe.

## 4. Memoização (sem React Compiler)

O repo **não** liga o Compiler, então memoização manual vale, mas só onde paga:

- **Valor de contexto**: `useMemo` no objeto e `useCallback` nas funções que ele expõe, como em `layout/shell-context.tsx` e `shared/ui/toast.tsx`. Sem isso, todo consumidor re-renderiza a cada render do provider.
- `useCallback` ou `memo` só quando o callback vai para filho memoizado ou para dependência de hook. Em handler comum, é ruído.
- Não memoize expressão barata (`status === 'active'`) nem componente que quase sempre recebe props novas.
- Default de prop não primitiva (objeto, array, `() => {}`) vira constante no módulo; senão invalida `memo` a cada render.
- Se o Compiler for ligado depois, remova a memoização manual de componentes; mantenha só o que serve de dependência estável de effect.

## 5. Composição

- React 19: use `<Context value={...}>` (sem `.Provider`) e `ref` como prop comum. O repo já faz o primeiro; não introduza `forwardRef` novo.
- Contexto com hook de acesso que lança erro fora do provider, no padrão de `useSession`, `useShell` e `useToast`.
- Prefira `children` e slots a uma lista crescente de props booleanas. Componente de `shared/ui` recebe `Readonly<Props>`, expõe só o que o consumidor precisa e documenta com `/** */` o contrato não óbvio.
- Componente controlado pela tela, não pelo estado interno: `ConfirmModal` recebe `visible`, `busy`, `onConfirm` e `onCancel`, e a tela decide quando fechar.
- Renderização condicional com número: `{count > 0 ? <Badge /> : null}`. `{count && <Badge />}` imprime `0`.
- `key` estável e única por item (id do dado). Índice só em lista estática, com `biome-ignore` justificado, como no `LoadingState`.
- Transição de baixa prioridade (filtro caro): `useTransition` e `isPending`, sem spinner que bloqueia a digitação.

## 6. Formulários, acessibilidade e texto

Detalhes e código em [`references/formularios-e-testes.md`](references/formularios-e-testes.md). O mínimo:

- Todo campo com rótulo associado. No `CFormInput`, `label` só liga ao campo se você passar `id` (o rótulo usa `htmlFor={id}`); gere com `useId()`.
- Ação que só navega é `<Link>`; ação que muda dado é `<button type="button">` ou `<form>`. Botão sem texto leva `aria-label`; ícone decorativo leva `aria-hidden="true"`.
- Estado de carregar, vazio e erro com os componentes de `@/shared/ui/states`; erro com `role="alert"`; aviso de resultado por `useToast()` (anunciado em `aria-live="polite"`).
- Modal com `aria-labelledby` ligado ao título (`useId`), como no `ConfirmModal`.
- Texto de interface em PT-BR com acento; identificadores em inglês.
- **Server Action**: confira autenticação e autorização **dentro de cada action**, mesmo que o formulário esteja numa página protegida. O menu só esconde item; a rota e a action continuam acessíveis a quem fizer a requisição.
- Autorização em `layout.tsx` não basta: o layout não re-renderiza a cada navegação. Verifique perto do dado (ver `02-guides/authentication.md`).

## 7. Testes

- Unitário no Vitest, `*.spec.ts(x)` ao lado do código; `describe`, `it` e `expect` são globais (não importe).
- Componente de cliente: `@testing-library/react` com consultas por papel (`getByRole`) e rótulo, como o usuário percebe. O componente assíncrono de servidor o Vitest não renderiza: cubra no e2e (`apps/backoffice-e2e/src`).
- Lógica pura (`nav.ts`, `breadcrumbs.ts`) é a mais barata de testar: extraia para função e teste sem DOM.

## Checklist

- [ ] Li a doc do Next em `node_modules/next/dist/docs/` sobre o que vou usar.
- [ ] `'use client'` só no ponto de entrada interativo; página de servidor intacta.
- [ ] `params` e `searchParams` com `await`; chamadas independentes em paralelo.
- [ ] Valor derivado calculado no render; effect só para sistema externo, com limpeza.
- [ ] Memoização só em valor de contexto, filho memoizado ou dependência de hook.
- [ ] Rótulos, `aria-*` e estados de carregar, vazio e erro tratados; texto em PT-BR.
- [ ] Autorização conferida no servidor (action e dado), não só no menu.
- [ ] Nenhum segredo em `NEXT_PUBLIC_*`.
- [ ] Teste de componente por papel, ou e2e quando for componente de servidor assíncrono.

Veja também: [`docs/guides/backoffice-nova-pagina.md`](../../../../../docs/guides/backoffice-nova-pagina.md), [`apps/backoffice/README.md`](../../../README.md), [ADR 0003](../../../../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md), [ADR 0006](../../../../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md).
