# infra/terraform: instruções para agentes

Terraform do ambiente local (Floci): 8 módulos e 2 envs, `infra-local-platform` (L1) e `infra-local-services` (L4). Comandos, estágios e o que o Floci suporta: [`README.md`](./README.md). A decisão e os gatilhos de evolução: [ADR 0011](../../docs/adr/0011-estrutura-profissional-do-terraform.md).

- **Dono único**: cada recurso é do Terraform ou do Serverless, pela regra do [ADR 0004](../../docs/adr/0004-serverless-e-terraform.md). Não declare aqui o que um `serverless.yml` já cria.
- **Contrato só pelo SSM** canônico (`/playground/<stage>/<região>/<domínio>/<recurso>/<atributo>`, módulo `ssm-contract`). O `services` lê a plataforma pelo SSM; nunca `terraform_remote_state` nem o state do outro env.
- **Tarefas pelo Nx**: `fmt`, `validate`, `lint`, `test`, `plan`, `apply`, `destroy` e `smoke`. Terraform à mão só com `TF_DATA_DIR=<raiz>/tmp/terraform/<projeto>`: nenhuma pasta `.terraform/` dentro do repositório.
- **Floci é o único alvo**: o provider usa `test`/`test` e só aceita endpoint em loopback. Não aponte um env para conta real.
- **Contornos do Floci** levam o marcador `WORKAROUND(floci-<versão>)` e são desligáveis por variável.
- **Sem estrutura antecipada**: nada de `stacks`, ambientes AWS, backend remoto, organização, WAF, CloudFront ou observabilidade antes do gatilho da tabela do ADR 0011. Módulo novo só com um env que o use.
- Mudou módulo ou env: `pnpm nx affected -t fmt validate lint test` e, se mexeu no que roda, `pnpm nx run infra-local:local:provision` no Floci.
