# nx-serverless (tools/serverless): instruções para agentes

Plugin local do Nx que infere os targets dos serviços a partir do `serverless.yml` (TypeScript, Go e Java com Gradle) e traz os executors (`validate`, `go-build`) e os generators (`service-ts`, `service-go`). Registro, opções, targets, configurations, executors e generators: [`README.md`](./README.md).

- O plugin é um pacote do workspace pnpm (`@org/nx-serverless`, pelo `tools/*` do `pnpm-workspace.yaml`), mas o Nx o carrega pelo caminho relativo: ele entra no `nx.json` como `./tools/serverless`, e executors e generators são referenciados do mesmo jeito (`./tools/serverless:validate`).
- A inferência depende de `custom.nxServerless` no `serverless.yml` de cada serviço. Mudar o formato dessa chave, os nomes dos targets ou as configurations afeta todos os serviços: rode o agente `change-impact-analysis` antes.
- A configuration padrão é `floci`, e o bloqueio de `remove` em `prod` é implementado aqui: não o enfraqueça.
- Os targets inferidos ficam em cache em `.nx/workspace-data`, com chave no código do próprio plugin: mudar `src/` invalida o cache sem `nx reset`.
- O plugin é ESM e carrega pelo type stripping do Node 24, com `erasableSyntaxOnly`: nada de `enum` nem de parameter properties.
- Os templates (`*__tmpl__`) ficam fora do Biome e do `tsc`. Para testá-los, gere um serviço provisório, rode os targets dele e mande-o para a lixeira com `trash`.
- Validação: `pnpm nx run-many -t test typecheck lint -p nx-serverless` e `pnpm exec biome check tools/serverless`.
