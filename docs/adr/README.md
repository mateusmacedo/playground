# Decisões de arquitetura (ADRs)

Cada ADR registra **uma** decisão que o time precisa entender daqui a seis meses: o contexto que a motivou, o que foi decidido e o que isso custa. Decisão sem registro vira folclore.

## Como numerar

- Quatro dígitos, em sequência: `0001`, `0002`, `0003`…
- Arquivo `NNNN-slug-em-kebab-case.md`, por exemplo `0007-observabilidade.md`.
- O número é do ADR para sempre. **Nunca reutilize nem renumere**: se duas branches criarem o mesmo número, quem fizer o merge depois pega o próximo livre antes de abrir o PR.
- Para mudar uma decisão, abra um ADR novo e marque o antigo como `Substituído por 00NN`. O texto do antigo não é reescrito, só ganha a nota de status.

## Status possíveis

| Status        | Significado                                       |
| ------------- | ------------------------------------------------- |
| `Proposto`    | Em discussão; ainda não vale como regra.          |
| `Aceito`      | Decidido e em vigor.                              |
| `Substituído` | Trocado por outro ADR (cite o número).            |
| `Rejeitado`   | Avaliado e descartado; fica o registro do porquê. |

## Como criar um ADR

1. Copie o [`TEMPLATE.md`](./TEMPLATE.md) para `NNNN-slug.md` com o próximo número livre.
2. Preencha **Contexto**, **Decisão** e **Consequências**. Seja curto: uma página basta.
3. Adicione a linha na tabela abaixo.
4. Abra o PR junto com a mudança que a decisão provoca, quando houver.

## Índice

| ADR                                                                | Título                                                         | Status   |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | -------- |
| [0001](./0001-nx-pnpm-ts-solution.md)                              | Nx 24 com pnpm no setup TypeScript solution                    | Aceito   |
| [0002](./0002-floci-ambiente-aws-local.md)                         | Floci como único ambiente AWS virtualizado local               | Aceito   |
| [0003](./0003-coreui-free-no-backoffice-nextjs.md)                 | CoreUI Free 5.x no backoffice Next.js                          | Aceito   |
| [0004](./0004-serverless-e-terraform.md)                           | Serverless Framework v4 e Terraform: quem é dono de quê        | Aceito   |
| [0005](./0005-angular-no-setup-ts-solution.md)                     | Angular no setup TypeScript solution                           | Proposto |
| [0006](./0006-next-16-4-6-e-allowed-dev-origins.md)                | Next.js 16.4.6 por segurança e o efeito do `allowedDevOrigins` | Aceito   |
| [0007](./0007-lint-e-formatacao-biome-eslint-minimo.md)            | Lint e formatação híbridos, Biome e ESLint mínimo              | Aceito   |
| [0008](./0008-adapters-de-runtime.md)                              | Adapters de runtime para portabilidade Lambda, ECS, EKS e EC2  | Aceito   |
| [0009](./0009-camadas-e-ordem-de-implantacao.md)                   | Camadas, fronteiras e ordem de implantação                     | Aceito   |
| [0010](./0010-versionamento-e-publicacao-no-github.md)             | Versionamento e publicação no GitHub com nx release            | Aceito   |
| [0011](./0011-estrutura-profissional-do-terraform.md)              | Terraform enxuto e evolutivo                                   | Aceito   |
| [0012](./0012-instrucoes-de-ia-por-projeto.md)                     | Instruções de IA por projeto                                   | Aceito   |
| [0013](./0013-analise-sonarqube-cloud.md)                          | Análise do SonarQube Cloud com a cobertura dos testes          | Aceito   |
| [0014](./0014-meta-de-seguranca-a-antecipa-https-e-logs-do-alb.md) | A meta de segurança A antecipa o HTTPS e os access logs do ALB | Aceito   |
| [0015](./0015-metas-de-qualidade-e-gate-obrigatorio.md)            | Metas de qualidade e gate obrigatório do SonarQube             | Aceito   |
| [0016](./0016-react-flow-no-editor-de-processos.md)                | React Flow no editor de processos                              | Aceito   |
| [0017](./0017-diagrama-da-execucao-em-processos-execucao.md)       | Diagrama da execução em `/processos/execucao`                  | Aceito   |
| [0018](./0018-contrato-openapi-e-mock-da-api-do-backoffice.md)     | Contrato OpenAPI por documento inteiro e mock Mockoon da API   | Aceito   |
