# Documentação

Ponto de partida da documentação do monorepo. Tudo aqui é em PT-BR; o código-fonte e as mensagens de commit são em inglês.

## Por onde começar

| Quero…                                                      | Leia                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Rodar o projeto na minha máquina                            | [Setup do ambiente local](./onboarding/setup-local.md)                |
| Subir o ambiente AWS local                                  | [Ambiente AWS local com o Floci](./onboarding/local-aws-floci.md)     |
| Entender como as peças se encaixam                          | [Visão de arquitetura](./architecture/overview.md)                    |
| Saber por que uma tecnologia foi escolhida                  | [Decisões de arquitetura (ADRs)](./adr/README.md)                     |
| Criar uma página no painel                                  | [Guia: nova página no backoffice](./guides/backoffice-nova-pagina.md) |
| Criar um serviço serverless                                 | [Guia: serviço serverless](./guides/servico-serverless.md)            |
| Rodar, cachear e depurar tarefas                            | [Guia: tarefas do Nx](./guides/nx-tarefas.md)                         |
| Entender a esteira, os limites de recurso e como ajustá-los | [Guia: desempenho e recursos](./guides/desempenho-e-recursos.md)      |
| Saber em que ordem a infraestrutura é criada e promovida    | [Guia: ordem de implantação](./guides/ordem-de-implantacao.md)        |
| Versionar e publicar (release)                              | [Guia: release](./guides/release.md)                                  |
| Rodar o Terraform local (plataforma e serviços no Floci)    | [`infra/terraform`](../infra/terraform/README.md)                     |
| Construir e publicar as imagens de container                | [Guia: imagens de container](./guides/imagens-de-container.md)        |
| Documentar uma operação de rotina ou de incidente           | [Modelo de runbook](./runbooks/TEMPLATE.md)                           |

## Estrutura

```text
docs/
├── README.md              este índice
├── adr/                   decisões de arquitetura (0001, 0002, ...)
├── architecture/          visão C4 (contexto e containers) e roadmap
├── guides/                como fazer: página, serviço serverless, tarefas do Nx, desempenho, ordem de implantação, release, imagens de container
├── onboarding/            setup local e ambiente AWS local
└── runbooks/              procedimentos operacionais (modelo em TEMPLATE.md)
```

## Convenções de documentação

- **Idioma**: PT-BR com acentuação correta. Termos técnicos e identificadores de código ficam como são.
- **Blocos de código** sempre com a linguagem na abertura (`bash`, `ts`, `json`, `yaml`, `text`).
- **Só cite o que existe.** Comandos e caminhos devem funcionar no estado atual do repositório; o que ainda não existe aparece como _roadmap_ ou _em construção_, nunca como fato.
- **Não cite arquivos efêmeros** (rascunhos de plano, estados de pipeline): a documentação aponta só para artefatos que duram.
- **Decisão nova vira ADR**, não parágrafo perdido num guia. Veja o [índice dos ADRs](./adr/README.md).
- **Formatação**: `pnpm format` corrige e `pnpm format:check` verifica (o Biome também cobre o Markdown); o `pre-commit` e o CI usam o mesmo Biome.
- **Operação nova vira runbook**, a partir do [`TEMPLATE.md`](./runbooks/TEMPLATE.md), em `docs/runbooks/<assunto>.md`.

## Outros pontos de entrada

- [`README.md`](../README.md) da raiz: visão geral, stack e início rápido.
- [`AGENTS.md`](../AGENTS.md): convenções e regras críticas para quem trabalha no código, incluindo agentes de IA.
- [`apps/backoffice/README.md`](../apps/backoffice/README.md): estrutura do painel e como estendê-lo.
- [`.agents/README.md`](../.agents/README.md): instruções de IA por escopo (`AGENTS.md`, rules, agents e skills de cada projeto; o Claude Code as lê por symlinks em `.claude/`), [ADR 0012](./adr/0012-instrucoes-de-ia-por-projeto.md).
