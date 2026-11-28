# backoffice-e2e: instruções para agentes

Testes ponta a ponta do painel (`apps/backoffice`) com Playwright. As convenções de teste do repositório estão na rule `testing-conventions` da raiz; as do painel, no [`AGENTS.md`](../backoffice/AGENTS.md) dele.

- Os testes ficam em `src/` (exemplo: `src/shell.spec.ts`) e cobrem os fluxos do shell. No CI, o e2e só roda se o projeto foi afetado.
- Chromium por padrão. `E2E_ALL_BROWSERS=1` (ou `pnpm e2e:full`) liga Firefox e WebKit, e a variável entra no hash do Nx.
- O `webServer` sobe o painel: localmente, o `next dev` direto em `apps/backoffice`, em `http://127.0.0.1:3000` (por isso o `allowedDevOrigins`, [ADR 0006](../../docs/adr/0006-next-16-4-6-e-allowed-dev-origins.md)); no CI, `backoffice:start`. Localmente o Nx fica de fora porque o `nx run` abre o painel num grupo de processos próprio, que o Playwright não encerra, e a porta 3000 ficava ocupada depois da rodada.
- Rode pelo Nx: `pnpm nx e2e backoffice-e2e`.

## API e mock

O painel do e2e lê e grava na API, servida pelo mock de [`apps/backoffice-mock`](../backoffice-mock/README.md) ([guia](../../docs/guides/backoffice-api.md), com exemplo de spec).

- **OBRIGATÓRIO**: o mock precisa estar no ar antes do e2e (`pnpm nx run backoffice-mock:up`). O `globalSetup` falha antes do primeiro teste, com a instrução, quando ele não responde.
- O `webServer` passa `NEXT_PUBLIC_API_URL` ao painel. Não tire o `env` do `playwright.config.mts`: sem ele, o Nx volta a subir o `backoffice:dev` como dependência do `e2e`, sem a variável. Um servidor já aberto na porta 3000 é reaproveitado e precisa ter sido iniciado com ela.
- O estado do mock é um só: os testes rodam com `workers: 1`. Não aumente.
- Spec que depende dos dados da API importa o `test` de `src/support/mock-test.ts`, que devolve o mock aos dados iniciais antes de cada teste. Semeie com `mock.seedBoard` e `mock.seedDefinition`, e não pelo `localStorage`, que agora só serve ao que é do navegador (tema, preferências). Falha e lentidão: `mockScenario.start(...)`, que mexe só nas chamadas à API.
- O apoio de `src/support/` não importa código do painel: os tipos de `mock-documents.ts` espelham os campos obrigatórios do contrato (`apps/backoffice-mock/openapi.yaml`), e os demais passam como campo livre.
- Não rode `reset`, `down` nem o e2e contra um mock que outra pessoa ou outro agente esteja usando: os três apagam os dados dele.
