# infra-local (infra/local): instruções para agentes

O Floci, ambiente AWS local do repositório: `docker-compose.yml`, o bootstrap em `init/` e os `scripts/`. A regra de que o Floci é o único emulador AWS, e o caminho canônico do SSM, estão no [`AGENTS.md`](../../AGENTS.md) da raiz. Comandos, recursos criados, parâmetros publicados, rede e limitações: [`README.md`](./README.md).

- Antes de mexer aqui, leia [`docs/onboarding/local-aws-floci.md`](../../docs/onboarding/local-aws-floci.md) e o [ADR 0002](../../docs/adr/0002-floci-ambiente-aws-local.md).
- Tarefas pelo Nx, sem cache: `pnpm nx run infra-local:up`, `status`, `logs`, `down`, `reset` e `validate`.
- Seed novo entra como `init/floci/NN-nome.sh`, reaproveitando as funções de `init/floci/_common.sh` (`ssm_publish`, `ssm_resource`, `try`). O bootstrap publica nome, ARN e URL de cada recurso em `/playground/local/us-east-1/shared/<recurso>/<atributo>`.
- Recurso ou parâmetro novo no bootstrap entra também nas tabelas "Recursos criados no bootstrap" e "Parâmetros SSM publicados" do README.
- Toda imagem do `docker-compose.yml` é fixada por `@sha256:`, e toda variável do compose existe no `.env.example`: o `validate` falha sem isso.
