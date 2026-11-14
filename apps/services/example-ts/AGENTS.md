# example-ts: instruções para agentes

Serviço HTTP de exemplo em TypeScript, uma Lambda atrás do HTTP API. As convenções comuns de serviço estão no [`AGENTS.md`](../AGENTS.md) de `apps/services`; estrutura, comandos e parâmetros, no [`README.md`](./README.md).

- Núcleo em `src/core`; entrypoint da Lambda em `src/entrypoints/lambda.ts`, que é o handler apontado pelo `serverless.yml`. Só os entrypoints logam (`src/entrypoints/logger.ts`, JSON no stdout com o nível de `LOG_LEVEL`).
- Runtime novo (container, por exemplo) entra como outro arquivo em `src/entrypoints/`, reaproveitando o mesmo núcleo.
- Tarefas pelo Nx: `pnpm nx test example-ts`, `pnpm nx typecheck example-ts` e `pnpm nx run example-ts:deploy` (Floci, a configuration padrão).
