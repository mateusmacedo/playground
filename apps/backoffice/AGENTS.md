# backoffice: instruções para agentes

Painel administrativo em Next.js 16 (App Router) com CoreUI React 5 ([ADR 0003](../../docs/adr/0003-coreui-free-no-backoffice-nextjs.md)). As convenções gerais estão no [`AGENTS.md`](../../AGENTS.md) da raiz e não se repetem aqui. Estrutura e extensão do painel: [`README.md`](./README.md). O bloco no fim deste arquivo é escrito pelo `next dev`: não edite entre os marcadores.

## Next.js 16

- **OBRIGATÓRIO**: esta versão do Next.js difere do que modelos conhecem. Antes de escrever código, leia o guia relevante em `node_modules/next/dist/docs/` e siga a rule `nextjs-16` (`.agents/rules/nextjs-16.md`), que lista o que o modelo costuma escrever errado. Na dúvida, Context7 `/vercel/next.js/v16.4.5`.
- **OBRIGATÓRIO**: o servidor do painel roda **sempre na porta 3000**, em qualquer situação: desenvolvimento, conferência de resultado, teste no navegador, MCP `next-devtools` e e2e (o `webServer` do `apps/backoffice-e2e` espera a 3000). Suba com `pnpm nx dev backoffice`, que já usa a 3000; nunca passe `--port` com outro valor nem suba uma segunda instância noutra porta, por motivo nenhum. Se a 3000 estiver ocupada, descubra o processo que a ocupa e pergunte ao usuário antes de agir.
- MCP `next-devtools` (`.mcp.json` da raiz, versão fixa): só funciona com `pnpm nx dev backoffice` rodando. Tools: `nextjs_index` (descobre o servidor de desenvolvimento), `nextjs_call` (chama as tools dele: `get_errors`, `get_logs`, `get_routes`, `get_page_metadata` e outras), `nextjs_docs` (aponta os docs da versão instalada) e `browser_eval` (aponta a CLI `agent-browser`).
- `allowedDevOrigins` em `next.config.js` existe por causa do e2e local; leia o [ADR 0006](../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md) antes de mudar.

## Código

- Alias `@/` aponta para `src`.
- Imports no modo `bundler`: relativo **sem** sufixo, `import type` ou `type` inline. `interface` nos contratos, `function` nos componentes.
- Texto de interface em PT-BR e acessível: rótulos, `aria-*` e papéis corretos.
- **OBRIGATÓRIO**: **nenhum segredo em `NEXT_PUBLIC_*`.** Essas variáveis entram no bundle do navegador no build. Segredos ficam no servidor.
- Configuração pública passa por `src/core/config/app-config.ts`; não leia `process.env` espalhado pelo código.

## Estrutura

```text
src/
  app/                       rotas do App Router; (painel)/ é o grupo do shell
  layout/                    shell, nav.ts e routes.ts
  shared/ui, shared/hooks    componentes e hooks reutilizáveis
  core/                      configuração pública e sessão
```

- Página nova mexe em três lugares: `src/app/(painel)/<rota>`, `src/layout/nav.ts` e `src/layout/routes.ts` ([guia](../../docs/guides/backoffice-nova-pagina.md)).
- A dependência aponta para dentro: `app` depende de `layout` e `shared`, que não dependem de `app`.

## Autorização, sessão e erros

- O menu lateral filtra por permissão, mas **não protege a rota**. Autorização de verdade é do servidor.
- Quando a sessão real existir (hoje `core/session` é só o contrato), o token de sessão fica fora do alcance do JavaScript do navegador: cookie `HttpOnly`, `Secure` e `SameSite`.
- Erro esperado é **valor**: estado de erro na tela (`ErrorState` de `shared/ui/states.tsx`); `error.tsx` só para o inesperado.

## Performance

- **Server Component por padrão**; `'use client'` só na folha que precisa de estado, efeito ou evento. Busca de dado no servidor, em paralelo quando independente.
- Importe ícones e componentes pelo nome (`@coreui/icons`, `@coreui/react`), sem carregar o pacote inteiro; carregamento dinâmico para o que é pesado e raro.
- Nada de lib grande no cliente para resolver o que o servidor resolve.

## Testes

- Vitest com `jsdom` e `@testing-library/react` (`fireEvent`; não há `user-event`), com os globals do Vitest ligados. Exemplo: `src/layout/nav.spec.ts`.
- Teste o comportamento visível ao usuário e consulte por papel e rótulo (`getByRole`), não por classe.
- O projeto não tem target `typecheck`: o `next build` faz a checagem de tipos.

## Assets de IA deste projeto

- Rule `nextjs-16` (`.agents/rules/`), que carrega ao mexer em `src/**` e `next.config.*`.
- Skills (`.agents/skills/`): `skill-react-best-practices` (decisões de React 19, Server ou Client Component, formulários e testes) e `skill-react-component-structure` (onde colocar e como nomear componentes, hooks e páginas).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
