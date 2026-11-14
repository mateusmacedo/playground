# backoffice-e2e: instruções para agentes

Testes ponta a ponta do painel (`apps/backoffice`) com Playwright. As convenções de teste do repositório estão na rule `testing-conventions` da raiz; as do painel, no [`AGENTS.md`](../backoffice/AGENTS.md) dele.

- Os testes ficam em `src/` (exemplo: `src/shell.spec.ts`) e cobrem os fluxos do shell. No CI, o e2e só roda se o projeto foi afetado.
- Chromium por padrão. `E2E_ALL_BROWSERS=1` (ou `pnpm e2e:full`) liga Firefox e WebKit, e a variável entra no hash do Nx.
- O `webServer` sobe o painel: `backoffice:dev` em `http://127.0.0.1:3000` localmente (por isso o `allowedDevOrigins`, [ADR 0006](../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md)) e `backoffice:start` no CI.
- Rode pelo Nx: `pnpm nx e2e backoffice-e2e`.
