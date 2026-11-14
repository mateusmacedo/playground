# ADR 0011: Terraform enxuto e evolutivo

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

A PoC do modelo evolutivo ([ADR 0008](./0008-adapters-de-runtime.md)) provou no Floci os três estágios no mesmo ALB (EC2, ECS e EKS), o blue/green por pesos na regra do ALB e o Quarkus no ECS. Depois dela, a estrutura cresceu para 34 módulos, uma camada de `stacks`, os ambientes `dev`, `homolog`, `prod` e `org` e as camadas `bootstrap`, `data` e `edge`, sem conta AWS, sem dado real e sem usuário externo.

Nada disso era exercitado: código que não roda contra nada apodrece. O custo era de leitura, de manutenção e de máquina (as pastas `.terraform/` espalhadas levaram o `terraform-ls` do editor a 3,7 GB). A base é jovem e cresce por incrementos: o nível certo é profissional, não enterprise.

## Decisão

**O que existe** é só o ambiente local, no Floci:

- 8 módulos: `network`, `ecr`, `alb`, `service-route`, `service-ec2`, `service-ecs`, `service-eks` e `ssm-contract`, na configuração que a PoC validou (HTTP, subnets públicas, sem NAT).
- 2 envs que chamam os módulos direto: `envs/local/platform` (L1, `infra-local-platform`) e `envs/local/services` (L4, `infra-local-services`). O `services` lê a plataforma só pelo SSM canônico ([ADR 0004](./0004-serverless-e-terraform.md)).
- Backend local: o state é um arquivo ao lado do env, e o Floci é descartável.
- `project.json` explícito, com `fmt`, `validate` e `lint` (tflint) em cache e `plan`, `apply` e `destroy` sem cache. Todo comando roda com `TF_DATA_DIR=tmp/terraform/<projeto>`, fora da árvore versionada.
- O `infra-local:local:provision` encadeia Floci, plataforma, push das imagens, serviços e smoke.

**Por que não há** `stacks`, ambientes nem organização:

- **`stacks`**: com um env por camada, a camada intermediária não tem a quem servir; o env chama o módulo, e a duplicação só aparece com o segundo ambiente.
- **`dev`, `homolog` e `prod`**: não existe conta AWS. Uma casca sem conta não é validada por nada, e o state remoto não tem onde morar.
- **Organização** (Organizations, SCPs, Identity Center, log archive, segurança centralizada): há zero contas para governar.

**Gatilhos de evolução**: cada passo entra quando o gatilho acontece, nunca antes.

| Gatilho               | Passo                                                   |
| --------------------- | ------------------------------------------------------- |
| Existir uma conta AWS | `envs/dev` e bootstrap do state (S3 com `use_lockfile`) |
| 2 ou mais ambientes   | `stacks` ou plugin Nx de inferência                     |
| Dado real             | Camada L2 com backup                                    |
| Usuários externos     | CloudFront e WAF                                        |
| Mais de uma conta     | Organizations e SCPs                                    |
| Serviço em produção   | Alarmes e observabilidade                               |

O material enterprise removido (módulos, stacks, ambientes, políticas do checkov, plugin Nx e runbook de bootstrap de conta) não foi mantido no repositório: ao implementar um gatilho, refaça-o a partir da tabela acima, com a conta e os ambientes reais em mãos.

Alternativas descartadas:

- **Manter a estrutura completa sem aplicar**: o custo de manutenção continua, e nada prova que ela funciona.
- **Plugin Nx que infere os projetos**: para 2 projetos, `project.json` explícito é mais simples de ler e de depurar. Volta com o gatilho de 2 ou mais ambientes.

## Consequências

- **Ganhos**: 8 módulos e 2 envs que sobem de ponta a ponta no Floci com um comando; o que existe é exercitado a cada `local:provision`; quem chega lê o Terraform inteiro em minutos.
- **Custos e riscos**: o primeiro ambiente na AWS exige escrever o bootstrap do state, o env e o que a configuração local não cobre (subnets privadas e NAT, HTTPS, deletion protection). No Floci, IAM não é aplicado e security groups não filtram tráfego, então uma permissão ou regra faltando só aparece na AWS.
- **Gatilho de revisão**: qualquer linha da tabela de gatilhos.
