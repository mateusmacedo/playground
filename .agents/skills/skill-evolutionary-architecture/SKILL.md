---
name: skill-evolutionary-architecture
description: >-
  Evolução da arquitetura do playground: modelo EC2 -> ECS -> EKS com artefato único (ADR 0008), estágios e migração blue/green no ALB, fitness functions (fronteiras do Nx, `pre-deploy`, `contract:check`, contrato de container), refatoração incremental e decisões adiadas (YAGNI, Last Responsible Moment). Use ao planejar migração de runtime ou de estágio, mover código entre `src/core`, `internal/core` e `packages/`, criar ou avaliar uma fitness function, ou decidir se algo vira ADR. NÃO usar para estrutura de pastas e camadas (use skill-architecture-patterns) nem para a regra de dono Serverless x Terraform (ADR 0004).
---

# Arquitetura evolutiva

> **Status: modelo aceito e provado só no Floci.** O ADR 0008 decidiu o modelo evolutivo, e o Terraform local ([`infra/terraform`](../../../infra/terraform/README.md), ADR 0011) já roda os três estágios (EC2, ECS e EKS) no mesmo ALB, com blue/green por pesos, para `example-go` e `example-quarkus`. Não há ambiente na AWS nem `contract:check`. Neste documento, **Existe** é o que está no repositório e **Padrão a seguir** é roadmap: não escreva código nem docs que suponham que existe.

**Obrigatório:** toda mudança fácil de desfazer (feature flag, rollout gradual, deploy pequeno, migração em passos compatíveis), como define a seção 2 da rule global `~/.claude/rules/senior-engineering.md` do mantenedor. O blue/green por pesos no ALB, abaixo, é a forma dela neste repositório.

## Quando usar

- Planejar a passagem de um serviço de um estágio (EC2, ECS, EKS) ou de um destino (Lambda, container) para outro.
- Decidir se código local deve subir para `packages/` ou ficar no serviço.
- Criar ou avaliar uma fitness function (checagem automática de uma regra de arquitetura).
- Decidir entre agir agora e adiar (YAGNI, Last Responsible Moment), e quando uma decisão vira ADR.

## O modelo em uma tabela

Fonte: `docs/adr/0008-adapters-de-runtime.md`. O ADR é a referência; aqui só o resumo.

| Estágio | Backends | Dono da infra |
| ------- | -------- | ------------- |
| 1 | 2 a 3 backends, cada um em uma EC2 micro (ASG de 1) atrás de um ALB compartilhado | Terraform (`service-ec2`) |
| 2 | Os backends viram tasks ECS no mesmo ALB (target groups novos) | Terraform (`service-ecs`) |
| 3 | Os serviços migram para EKS, com ingress próprio | Terraform (`service-eks`) |

Lambdas seguem no Serverless nos três estágios. A migração entre estágios é **blue/green no ALB** com target groups ponderados: sobe o novo, desloca o peso, desliga o antigo. O passo a passo está em `references/migracao-entre-estagios.md`.

## Invariantes que mantêm a migração barata

A migração só é "trocar o destino" enquanto estas condições valem. Cada uma é uma fitness function em potencial.

| Invariante | Se for violado | Como se verifica |
| ---------- | -------------- | ---------------- |
| Núcleo puro: `src/core` e `internal/core` não importam runtime (Lambda, HTTP, SDK) | A migração vira reescrita | Biome `noRestrictedImports` no núcleo; `go list -deps` (padrão a seguir) |
| Entrypoints finos: só traduzem evento em chamada do núcleo e resultado em resposta | Regra de negócio fica presa a um destino | Testes do entrypoint (existe: `lambda.spec.ts`) |
| Artefato único: uma imagem OCI por SHA em EC2, ECS e EKS; zip na Lambda | "Funciona no ECS, quebra no EKS" | Comparar tag e digest entre destinos (padrão a seguir) |
| Contrato de container: `PORT`, `/health`, logs JSON no stdout, `SIGTERM` gracioso, stateless | O ALB ou o orquestrador derrubam e reiniciam mal | Smoke test na camada L6 (padrão a seguir) |
| Configuração por variável de ambiente e SSM canônico; segredos no Secrets Manager | Configuração presa a um destino | `contract:check` (padrão a seguir) |
| Serviços não dependem de serviços; um único dono por recurso (ADR 0009 e 0004) | Migrar um serviço arrasta outros | Fronteiras do Nx; regra de dono do ADR 0004 |

**Pendência declarada, não esconda:** no Floci uma EC2 é um container Docker, e rodar a imagem do serviço dentro dela (Docker dentro do container) **não foi verificado**. Se não funcionar, o estágio 1 roda o binário via systemd e o artefato de EC2 passa a diferir do de container, quebrando o invariante do artefato único nesse estágio. Não afirme que o artefato único vale no estágio 1 antes da PoC do ADR 0008.

## Fitness functions

O que já protege e o que falta. Os trechos de configuração e os scripts estão em `references/fitness-functions.md`.

| Fitness function | Status |
| ---------------- | ------ |
| `pnpm nx sync:check` (referências do TypeScript) | Existe |
| Biome `noImportCycles` como erro (ciclo de import) | Existe |
| `@nx/enforce-module-boundaries` no ESLint | Existe, mas permissivo: `depConstraints` hoje é `*` para `*` |
| Target `pre-deploy` (executor `validate`): confere `serverless.yml` contra as políticas do monorepo | Existe (cacheado) |
| Testes dos entrypoints sem lógica de negócio | Existe nos exemplos |
| Núcleo sem import de runtime (Biome por pasta e `go list -deps`) | Padrão a seguir |
| `depConstraints` apertado por tags | Padrão a seguir |
| Smoke do contrato de container (`/health`, JSON no stdout, `SIGTERM`) | Padrão a seguir (L6) |
| Artefato único: mesmo digest em todo destino e na promoção | Padrão a seguir (L3 e L4) |
| `contract:check`: todo `${ssm:...}` do `serverless.yml` existe no catálogo do Terraform | Roadmap (ADR 0004) |

Regras de uso:

- Rode no nível rápido por padrão (`pnpm nx affected -t lint typecheck test`, o mesmo do `pre-push` e do PR) e completo no release. Uma fitness function lenta demais é desligada, e aí não protege.
- Comece uma regra nova como aviso quando o código atual a viola, corrija as ocorrências e só então promova a erro (Biome aceita `warn` e `error` por regra).
- Teste a própria regra: escreva um arquivo que a viola e confirme que ela falha.

## Refatoração incremental

### Local para compartilhado

Comece local, no serviço (`src/core`). Suba para `packages/<lib>` quando **dois ou mais projetos** de fato usam o mesmo código; um segundo uso hipotético não conta.

1. Gere a lib com o gerador do Nx (skill `nx-generate`), sem copiar pasta.
2. Mova código, testes e tipos juntos.
3. Ligue por dependência de workspace do pnpm (`workspace:*`), nunca por `paths` no `tsconfig`.
4. Antes de apagar o original, busque todas as referências: imports, mocks de teste, imports dinâmicos e configs.
5. Valide: `pnpm nx sync`, `pnpm nx affected -t lint typecheck test build` e `pnpm format:check`.

Em Go, cada serviço tem o próprio `go.mod`, e `internal/` só é importável dentro do módulo. Compartilhar código entre serviços Go exigiria um módulo próprio; o gerenciamento de Go pelo Nx (`@nx-go/nx-go`) é roadmap.

### Extrair lógica de dentro do entrypoint

1. Ache a parte pura (entrada vira saída, sem I/O) no handler.
2. Crie a função em `src/core/` (ou `internal/core/`) com o teste ao lado.
3. O entrypoint passa a só traduzir. O exemplo é `src/entrypoints/lambda.ts`, que chama `sayHello` de `src/core/hello.ts` e devolve a resposta.
4. Confirme que o núcleo não ganhou import de runtime.

### Strangler Fig

Para trocar uma implementação grande: crie a nova ao lado da antiga, migre os consumidores aos poucos e remova a antiga quando ninguém a usa. Cada passo mantém lint, typecheck e testes verdes. Na infraestrutura é exatamente a migração blue/green entre estágios.

## YAGNI e Last Responsible Moment aqui

- **Porta só onde há I/O real a isolar.** O fake de teste conta como segunda implementação. Um cálculo puro não precisa de interface, fábrica nem builder. O `sayHello` de `src/core/hello.ts` já é uma função pura e assim deve ficar.
- **Não construa o destino antes de precisar.** Hoje os serviços são só Lambda; o entrypoint de container (`main-http`) entra quando um serviço for para container, não antes.
- **Registre o que foi adiado e o gatilho de revisão**, como fazem os ADRs:

| Adiado | Por quê |
| ------ | ------- |
| Angular | Decisão em aberto (`docs/adr/0005-angular-no-setup-ts-solution.md`) |
| Destino de container do estágio 1 | Depende da PoC no Floci (ADR 0008) |
| Adapters, Terraform, camadas, `contract:check` | Roadmap; PoC pendente (ADR 0008 e 0009) |

## Quando uma decisão vira ADR

Escreva ADR quando a decisão **muda um invariante**, escolhe entre alternativas reais ou cria uma dependência cara de reverter. O roteiro cabe em cinco perguntas: qual o problema, quais as opções, quais os trade-offs, qual a recomendação e como reverter. Use `docs/adr/TEMPLATE.md` (numeração de quatro dígitos) e inclua o **gatilho de revisão**. Quando algo ainda não existe, diga "Hoje:" como os ADRs 0004, 0008 e 0009. Para trocar uma decisão, escreva um ADR novo e marque o antigo como `Substituído por NNNN`, como o template prevê.

## Checklist

- [ ] A mudança preserva os invariantes (núcleo puro, entrypoint fino, artefato único, contrato de container).
- [ ] Nada do roadmap foi tratado como existente em código ou docs.
- [ ] Decisão adiada tem gatilho; decisão tomada virou ADR.
- [ ] Refatoração em passos pequenos, cada um validado antes do próximo.
- [ ] Todas as referências foram buscadas ao mover código (imports, mocks, configs).
- [ ] Fitness function nova foi testada contra uma violação proposital.

## Veja também

- `docs/adr/0008-adapters-de-runtime.md`, `docs/adr/0004-serverless-e-terraform.md` e `docs/adr/0009-camadas-e-ordem-de-implantacao.md`.
- `docs/architecture/overview.md` (o que existe e o que é roadmap) e `docs/guides/ordem-de-implantacao.md`.
- Skill `skill-architecture-patterns` (hexagonal, camadas L0 a L6, dono único) e `references/` desta skill.
