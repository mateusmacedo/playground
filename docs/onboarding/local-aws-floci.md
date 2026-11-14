# Ambiente AWS local com o Floci

O Floci é o **único** ambiente AWS virtualizado do repositório ([ADR 0002](../adr/0002-floci-ambiente-aws-local.md)). É um emulador compatível com a API do LocalStack: tudo que roda nele deve rodar igual na AWS.

## TL;DR

```bash
pnpm nx up infra-local       # sobe o Floci e provisiona os recursos iniciais
pnpm nx status infra-local   # containers e saúde
pnpm nx down infra-local     # derruba (os dados ficam no volume)
pnpm nx reset infra-local    # apaga o volume e recria do zero
```

- Endpoint: `http://localhost:4566`
- Console web: `http://localhost:4566/_floci/ui`
- Credenciais fictícias: `test` / `test`, conta `000000000000`, região `us-east-1`

## Pré-requisitos

- **Docker** com o plugin Compose v2 (`docker compose version`) e o daemon em execução.
- Seu usuário precisa acessar `/var/run/docker.sock` (grupo `docker`, no Linux). O Floci usa o socket para criar os containers de Lambda e do console.
- Portas **4566** (Floci) e **4500** (console web) livres em `127.0.0.1`.
- **AWS CLI v2**, para inspecionar os recursos (opcional para subir, útil para verificar).

## Subir

```bash
pnpm install
pnpm nx up infra-local
```

O target `up` faz duas coisas, em ordem:

1. `docker compose up -d --wait floci`: sobe o emulador e espera ele ficar saudável.
2. `docker compose run --rm -T floci-bootstrap`: roda o bootstrap, que cria os recursos iniciais e termina.

Rodar `up` de novo é seguro: o bootstrap é **idempotente**. Recurso que já existe só é registrado no log, e o redrive e o tempo de visibilidade das filas são sincronizados.

## O que o bootstrap cria

Com os padrões de `infra/local/.env.example`:

| Tipo | Nome                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S3   | `playground-local-uploads`                                                                                                           |
| SQS  | `playground-local-sample-events` e a DLQ `playground-local-sample-events-dlq` (redrive após 5 recebimentos, visibilidade de 180 s)   |
| SSM  | `/playground/local/us-east-1/backoffice/app/name` = `Playground Backoffice`, e os parâmetros de cada recurso semeado (tabela abaixo) |

Tabelas DynamoDB não são criadas por padrão (`FLOCI_SEED_TABLES` vazia). Quando informadas, ganham só a chave de partição `pk` (string): o esquema de cada tabela é responsabilidade do deploy do serviço dono dela.

### Convenção dos parâmetros SSM

```text
/<LOCAL_APP>/<LOCAL_STAGE>/<AWS_REGION>/<dominio>/<recurso>/<atributo>
/playground/local/us-east-1/backoffice/app/name
```

Os serviços seguem a mesma forma: a configuração de um serviço é `<serviço>/config/<chave>`, por exemplo `/playground/local/us-east-1/example-ts/config/log-level` ([guia de serviço serverless](../guides/servico-serverless.md#parâmetros-ssm)).

No `.env`, o seed recebe só o trecho `dominio/recurso/atributo=valor`, separado por vírgula quando houver mais de um; o prefixo é montado pelo bootstrap. O valor não pode conter vírgula.

### Parâmetros SSM que o bootstrap publica

Todo recurso semeado publica o próprio identificador no SSM, que é como os serviços o encontram, em vez de nomes fixos no código. O nome no SSM é o nome real do recurso **sem** o prefixo `<LOCAL_APP>-<LOCAL_STAGE>-`, mais o sufixo do tipo, sob o domínio `FLOCI_SEED_SSM_DOMAIN` (padrão `shared`). A publicação usa `put-parameter --overwrite`, então o `up` repete sem efeito colateral e repara parâmetros apagados.

Com os padrões (prefixo `/playground/local/us-east-1`):

| Parâmetro                         | Valor                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `/shared/uploads-bucket/name`     | `playground-local-uploads`                                              |
| `/shared/uploads-bucket/arn`      | `arn:aws:s3:::playground-local-uploads`                                 |
| `/shared/sample-events-queue/url` | `http://localhost:4566/000000000000/playground-local-sample-events`     |
| `/shared/sample-events-queue/arn` | `arn:aws:sqs:us-east-1:000000000000:playground-local-sample-events`     |
| `/shared/sample-events-dlq/arn`   | `arn:aws:sqs:us-east-1:000000000000:playground-local-sample-events-dlq` |
| `/backoffice/app/name`            | `Playground Backoffice` (vem de `FLOCI_SEED_SSM_PARAMETERS`)            |

Atributos por tipo de recurso:

| Tipo   | Recurso no SSM  | Atributos     |
| ------ | --------------- | ------------- |
| Bucket | `<nome>-bucket` | `name`, `arn` |
| Fila   | `<nome>-queue`  | `url`, `arn`  |
| DLQ    | `<nome>-dlq`    | `arn`         |
| Tabela | `<nome>-table`  | `name`, `arn` |

Um serviço SQS lê a fila pelo par `url` e `arn`: com `--queueParam=shared/sample-events-queue`, o gerador aponta o serviço para `/shared/sample-events-queue/arn` e `/shared/sample-events-queue/url` ([guia de serviço serverless](../guides/servico-serverless.md#o-que-cada-tipo-traz)). Para listar tudo:

```bash
aws ssm get-parameters-by-path --path /playground/local --recursive
```

A fonte da tabela é o [`infra/local/README.md`](../../infra/local/README.md#parâmetros-ssm-publicados).

## Verificar

Pelo Nx:

```bash
pnpm nx status infra-local
```

Ele mostra os containers (`docker compose ps -a`) e consulta `http://localhost:4566/_floci/health`.

Pelo AWS CLI, apontando para o Floci:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1

aws sts get-caller-identity
aws s3 ls
aws sqs list-queues
aws ssm get-parameters-by-path --path /playground/local/us-east-1 --recursive
```

Para validar a **configuração** do ambiente sem subir containers (sintaxe do compose e dos scripts, imagens fixadas por digest, `.env.example` cobrindo as variáveis do compose, `.env` ignorado pelo git):

```bash
pnpm nx validate infra-local
```

## Console web

Abra `http://localhost:4566/_floci/ui`. O Floci sobe o console como container auxiliar sob demanda (imagem `floci/floci-ui`). Ele **não tem autenticação** e controla todos os serviços; por isso fica ligado só a `127.0.0.1`.

## Variáveis

Copie `infra/local/.env.example` para `infra/local/.env` para customizar. O `.env` é ignorado pelo git. Os valores do exemplo são os mesmos padrões do compose, então o ambiente sobe sem `.env`.

| Variável                        | Padrão                                      | Para quê                                                                                                                   |
| ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AWS_REGION`                    | `us-east-1`                                 | Região dos recursos e dos ARNs.                                                                                            |
| `FLOCI_STORAGE_MODE`            | `persistent`                                | `memory`, `persistent`, `hybrid` ou `wal`.                                                                                 |
| `FLOCI_LAMBDA_TIMEOUT`          | `60`                                        | Timeout padrão das Lambdas, em segundos.                                                                                   |
| `FLOCI_LAMBDA_HOT_RELOAD`       | `false`                                     | Monta o código direto do disco (`S3Bucket=hot-reload`).                                                                    |
| `FLOCI_HOSTNAME`                | vazio                                       | Vazio mantém `localhost:4566` nas URLs devolvidas. Mude só com motivo.                                                     |
| `FLOCI_CFN_ALLOW_STUBS`         | `true`                                      | Se `true`, o CloudFormation aceita em silêncio recursos que o Floci não implementa; `false` faz a stack falhar nesse caso. |
| `FLOCI_WAIT_TIMEOUT`            | `120`                                       | Segundos de espera pelo Floci antes de o bootstrap falhar.                                                                 |
| `LOCAL_APP`                     | `playground`                                | Primeiro segmento do caminho SSM.                                                                                          |
| `LOCAL_STAGE`                   | `local`                                     | Segundo segmento do caminho SSM.                                                                                           |
| `FLOCI_SEED_SSM_DOMAIN`         | `shared`                                    | Domínio sob o qual o bootstrap publica os parâmetros dos recursos semeados.                                                |
| `FLOCI_SEED_BUCKETS`            | `playground-local-uploads`                  | Buckets, separados por vírgula. Vazia desliga o seed.                                                                      |
| `FLOCI_SEED_QUEUES`             | `playground-local-sample-events`            | Filas; cada uma ganha uma DLQ `<nome>-dlq`.                                                                                |
| `FLOCI_SEED_QUEUE_MAX_RECEIVES` | `5`                                         | Recebimentos antes de a mensagem ir para a DLQ (inteiro de 1 a 1000).                                                      |
| `FLOCI_SEED_TABLES`             | vazia                                       | Tabelas mínimas (chave `pk`).                                                                                              |
| `FLOCI_SEED_SSM_PARAMETERS`     | `backoffice/app/name=Playground Backoffice` | Parâmetros no formato `dominio/recurso/atributo=valor`.                                                                    |

## Adicionar um seed

O bootstrap executa, em ordem, todo script `infra/local/init/floci/NN-nome.sh` (dois dígitos no início). Crie `02-my-seed.sh`, mantenha-o idempotente e use as funções de `_common.sh`. Rode `pnpm nx up infra-local` para aplicar.

## Troubleshooting

| Sintoma                                                   | Causa provável                                                                               | O que fazer                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `up` falha em `--wait` ou trava                           | O Floci não ficou saudável.                                                                  | `pnpm nx logs infra-local` e confira o erro. Confirme que o Docker está rodando.                                               |
| `port is already allocated` na 4566                       | Outro emulador (LocalStack, outra cópia do Floci) usa a porta.                               | Derrube o outro. Este repositório só aceita o Floci.                                                                           |
| `permission denied` em `/var/run/docker.sock`             | Seu usuário não está no grupo `docker`.                                                      | Adicione-o ao grupo e abra uma nova sessão.                                                                                    |
| O bootstrap termina com avisos                            | O Floci não suporta algum recurso pedido.                                                    | Avisos não abortam. Leia a mensagem e, se o recurso for necessário, registre a lacuna.                                         |
| O bootstrap termina com `ERRO` e código 1                 | Falha que não é recurso não suportado: rede, credencial ou valor inválido em `FLOCI_SEED_*`. | Leia as linhas `ERRO`: os demais seeds já rodaram. Corrija e rode `up` de novo (é idempotente).                                |
| `ECONNREFUSED` ou `Could not connect to the endpoint URL` | O Floci não está de pé, ou o `AWS_ENDPOINT_URL` está errado.                                 | `pnpm nx status infra-local` e confira o endpoint `http://localhost:4566`.                                                     |
| Recursos antigos ou estado estranho                       | O armazenamento é persistente entre execuções.                                               | `pnpm nx reset infra-local` apaga o volume e recria.                                                                           |
| URL de fila (`QueueUrl`) com host inesperado              | `FLOCI_HOSTNAME` foi definido.                                                               | Deixe vazio para manter `localhost:4566`.                                                                                      |
| Uma Lambda não alcança o Floci                            | Ela roda em container na rede `playground-floci`, e não no host.                             | Use o `AWS_ENDPOINT_URL` que o Floci entrega à função (`http://localhost.floci.io:4566`), e não um `localhost` fixo no código. |

## O que já foi exercitado

Só o caminho **Lambda** (serviços Serverless implantados no Floci) foi usado neste repositório. A emulação de EC2 (containers Docker), ECS (tasks como containers reais), EKS (clusters k3s), ALB, NLB e CloudFront vem da documentação do Floci e **não foi testada na versão 2.4.0** fixada aqui. A PoC do [ADR 0008](../adr/0008-adapters-de-runtime.md) vai verificar essa rota.

## Limitações conhecidas

Um emulador não é a AWS. Os pontos abaixo já foram observados neste ambiente e estão detalhados em [`infra/local/README.md`](../../infra/local/README.md):

- **IAM não é aplicado.** O Floci aceita qualquer chamada e não avalia policies: uma permissão que falta passa no local e falha na AWS. Valide policies fora do emulador.
- **CloudFormation aceita em silêncio o que não suporta.** Um recurso sem implementação vira um "stub": a stack chega a `CREATE_COMPLETE` sem criar nada, só com um aviso no log. `FLOCI_CFN_ALLOW_STUBS=false` faz a stack falhar nesse caso.
- **URLs geradas dentro de uma Lambda** (como um presigned) apontam para `localhost.floci.io` e não servem para o navegador.
- **Só uma instância do Floci por máquina**: a porta 4566 é fixa. Pare o Floci de outros projetos antes de subir este.
- **Console e API sem autenticação**: por isso as portas só publicam em `127.0.0.1`.

## Referências

- [`infra/local/README.md`](../../infra/local/README.md): detalhes de rede, `FLOCI_HOSTNAME` e limitações, junto do código.
- [ADR 0002](../adr/0002-floci-ambiente-aws-local.md): por que o Floci.
- [ADR 0004](../adr/0004-serverless-e-terraform.md): como o Serverless Framework e o Terraform se dividem.
- [Guia de serviço serverless](../guides/servico-serverless.md): deploy no Floci e na AWS.
