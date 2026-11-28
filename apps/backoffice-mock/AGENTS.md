# backoffice-mock (apps/backoffice-mock): instruções para agentes

O contrato da API do painel ([`openapi.yaml`](./openapi.yaml), OpenAPI 3.1) e o servidor de mock dela, o Mockoon CLI em container. Endereço, targets, dados iniciais, cenários, operações só do mock e limites: [`README.md`](./README.md). As convenções gerais estão no [`AGENTS.md`](../../AGENTS.md) da raiz e não se repetem aqui.

- O mock é só HTTP e não emula AWS: fica fora do `infra/local`, e nada daqui cria serviço em `apps/services`, Lambda ou Terraform. O backend real é de outra fase.
- **O contrato manda.** Operação, cabeçalho ou erro novo entra primeiro no `openapi.yaml`, com exemplo, e só depois no mock e no painel. Os schemas seguem os tipos do painel (`quadro/model/board.ts` e `src/shared/process/` do backoffice) e não podem ser mais restritos que a leitura dele: sem `additionalProperties: false`, sem `format` conferido, e tipo aberto onde o painel lê de forma aberta.
- O `mockoon/environment.json` é gerado: não edite à mão. Mude `src/mockoon-*.mjs`, `seed/` ou o contrato e rode `pnpm nx run backoffice-mock:generate-environment`. A ordem das respostas em `src/mockoon-refusals.mjs` é a ordem das checagens do contrato, porque o Mockoon serve a primeira cuja regra casa.
- A pasta `samples/` é gravada pelos testes do painel. Não crie nem corrija amostra à mão: se uma amostra não valida, o contrato ou o painel mudou, e é isso que precisa ser resolvido.
- O código é ESM puro (`.mjs`), sem `tsconfig`, como o `tools/ai`: sem tipos, comentário só `WHY:` e `NOTE:`. Testes Vitest ao lado, em `src/*.spec.mjs`, com cobertura acima de 90% em linhas e ramos.
- Use `pnpm nx run backoffice-mock:<target>`: `nx reset` e `nx generate` são comandos do próprio Nx e não chamam os targets `reset` e `generate-environment`.
- A imagem é fixada por `tag@digest`, a porta é publicada só em `127.0.0.1`, toda variável do compose existe no `.env.example`, e o token da API administrativa é local e fictício: o `test` confere os três primeiros.
- O `validate` roda no CI (`nx affected -t validate`) e por isso não pode depender do container; o que precisa dele no ar é o `smoke`.
- Validação: `pnpm nx run-many -t test validate -p backoffice-mock` e `pnpm exec biome check apps/backoffice-mock`; com mudança no mock, suba o container (`up`), rode `smoke` e pare (`down`).
