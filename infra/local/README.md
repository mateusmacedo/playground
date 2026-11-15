# infra/local

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground) [Métricas desta pasta no SonarQube Cloud](https://sonarcloud.io/code?id=mateusmacedo_playground&selected=mateusmacedo_playground%3Ainfra%2Flocal)

Ambiente AWS local do monorepo. O [Floci](https://github.com/floci-io/floci) (MIT, versão fixada em `docker-compose.yml`) é o único ambiente virtualizado: tudo que for desenvolvido aqui deve rodar igual na AWS (Lambda, API Gateway, S3, SQS, SNS, DynamoDB, SSM, Secrets Manager, Cognito, RDS).

Pré-requisitos: Docker com Compose v2 e, para os comandos de verificação, o AWS CLI v2.

## Subir e parar

Os comandos rodam pelo Nx, sem cache:

```bash
pnpm nx run infra-local:up        # sobe o Floci, espera ficar saudável e roda o bootstrap
pnpm nx run infra-local:status    # containers e /_floci/health
pnpm nx run infra-local:logs      # segue os logs
pnpm nx run infra-local:down      # para e remove os containers (mantém os dados)
pnpm nx run infra-local:reset     # apaga o volume de dados e sobe de novo
pnpm nx run infra-local:validate  # confere compose, scripts e .env.example sem subir nada
```

O `up` é idempotente: pode rodar quantas vezes quiser, pois o bootstrap só cria o que ainda não existe. Sem `.env` ele usa os padrões do compose; para customizar, copie `.env.example` para `.env` (ignorado pelo git).

O `reset` apaga também os containers e volumes que o próprio Floci cria no namespace `playground` (inclusive o registry local do ECR); as imagens voltam pelo `docker:push-floci`.

## Conectar e verificar

O endpoint único fica em `http://localhost:4566`, só em loopback. As credenciais são fictícias, e o Floci não as valida:

```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1

aws s3 ls
aws sqs list-queues
aws ssm get-parameters-by-path --path /playground --recursive
curl -s http://localhost:4566/_floci/health
```

`AWS_ENDPOINT_URL` é lido pelo AWS CLI v2 e pelos SDKs atuais (JS v3, Java v2, Go v2, boto3), então os apps não precisam de configuração de endpoint no código.

A interface web fica em `http://localhost:4566/_floci/ui`. Na primeira visita o Floci sobe o container `floci/floci-ui` (porta 4500, só em loopback, imagem fixada por `tag@digest` no compose) e redireciona quando ele estiver pronto.

## Recursos criados no bootstrap

O container `floci-bootstrap` (AWS CLI fixado por digest) roda os scripts `init/floci/NN-*.sh` em ordem e sai. Os seeds vêm das variáveis `FLOCI_SEED_*` do `.env`, listas separadas por vírgula; variável vazia desliga o seed:

| Variável                    | Efeito                                                            | Padrão                                      |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `FLOCI_SEED_BUCKETS`        | Buckets S3                                                        | `playground-local-uploads`                  |
| `FLOCI_SEED_QUEUES`         | Filas SQS, cada uma com DLQ `<nome>-dlq` e redrive                | `playground-local-sample-events`            |
| `FLOCI_SEED_TABLES`         | Tabelas DynamoDB mínimas (chave `pk`, string)                     | vazio                                       |
| `FLOCI_SEED_SSM_PARAMETERS` | Parâmetros `dominio/recurso/atributo=valor` (String, sem vírgula) | `backoffice/app/name=Playground Backoffice` |

Os parâmetros SSM ganham o prefixo canônico `/<LOCAL_APP>/<LOCAL_STAGE>/<AWS_REGION>/`, por exemplo `/playground/local/us-east-1/backoffice/app/name`. Recurso que o Floci declara não suportar (erro `UnsupportedOperation`) vira `AVISO` no log e o bootstrap continua. Qualquer outra falha de seed (rede, credencial, valor inválido em `FLOCI_SEED_*`) vira `ERRO`: os demais seeds ainda rodam e o bootstrap termina com código 1 e o resumo `N aviso(s), M falha(s)`. Cada fila tem redrive após 5 recebimentos (`FLOCI_SEED_QUEUE_MAX_RECEIVES`, inteiro de 1 a 1000) e `VisibilityTimeout` de 180 s, 6 vezes o timeout de 29 s das Lambdas. Seeds específicos de um app entram como um novo `NN-nome.sh` reaproveitando `_common.sh`.

Enquanto não existe a camada de dados do Terraform (L2), o bucket de uploads e a fila `sample-events` são do seed. Quando ela existir, os dois mudam de dono sem mudar nome nem parâmetro SSM, para não haver dois donos ([ADR 0004](../../docs/adr/0004-serverless-e-terraform.md)).

## Parâmetros SSM publicados

Todo recurso semeado publica o próprio identificador no SSM, que é como os serviços o encontram (em vez de nomes fixos no código). O nome do recurso no SSM é o nome real sem o prefixo `<LOCAL_APP>-<LOCAL_STAGE>-`, mais o sufixo do tipo, sob o domínio `FLOCI_SEED_SSM_DOMAIN` (padrão `shared`). A publicação usa `put-parameter --overwrite`, então o `up` repete sem efeito colateral e repara parâmetros apagados.

Com os padrões, o bootstrap grava estes parâmetros (prefixo `/playground/local/us-east-1`), além de `/backoffice/app/name` (`Playground Backoffice`, de `FLOCI_SEED_SSM_PARAMETERS`):

| Parâmetro                         | Valor                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `/shared/uploads-bucket/name`     | `playground-local-uploads`                                              |
| `/shared/uploads-bucket/arn`      | `arn:aws:s3:::playground-local-uploads`                                 |
| `/shared/sample-events-queue/url` | `http://localhost:4566/000000000000/playground-local-sample-events`     |
| `/shared/sample-events-queue/arn` | `arn:aws:sqs:us-east-1:000000000000:playground-local-sample-events`     |
| `/shared/sample-events-dlq/arn`   | `arn:aws:sqs:us-east-1:000000000000:playground-local-sample-events-dlq` |

Por tipo de recurso, os atributos que o seed publica são:

| Tipo   | Recurso no SSM  | Atributos     |
| ------ | --------------- | ------------- |
| Bucket | `<nome>-bucket` | `name`, `arn` |
| Fila   | `<nome>-queue`  | `url`, `arn`  |
| DLQ    | `<nome>-dlq`    | `arn`         |
| Tabela | `<nome>-table`  | `name`, `arn` |

Para listar tudo: `aws ssm get-parameters-by-path --path /playground/local --recursive`.

## Rede e `FLOCI_HOSTNAME`

Os apps de dev rodam no host (`next dev`, `serverless`), mas as Lambdas rodam em containers criados pelo Floci, na rede `playground-floci`. `FLOCI_HOSTNAME` fica vazio de propósito:

- Com `FLOCI_HOSTNAME=floci`, URLs devolvidas pelo Floci (como a `QueueUrl` do SQS) viram `http://floci:4566/...`, nome que o host não resolve.
- Vazio, o host recebe `http://localhost:4566/...`, e as Lambdas recebem `AWS_ENDPOINT_URL=http://localhost.floci.io:4566`, que o DNS embutido do Floci resolve para o próprio container dentro da rede. Testado com uma Lambda `nodejs22.x` que alcançou `/_floci/health` e enviou mensagem ao SQS.

Limitação: uma URL gerada por dentro de uma Lambda (como um presigned) aponta para `localhost.floci.io` e não serve para o navegador. Um container próprio que precise falar com o Floci deve entrar na rede `playground-floci` e usar `http://floci:4566`.

Um ALB criado no Floci (por exemplo, pelo Terraform) abre o socket do listener dentro do container do Floci. O compose publica o listener HTTPS da porta 443 em `127.0.0.1:${FLOCI_ALB_HTTPS_PORT}` (padrão `8443`) e o HTTP da porta 80, que só redireciona para o HTTPS, em `127.0.0.1:${FLOCI_ALB_HTTP_PORT}` (padrão `8088`; a 8080 fica livre para os serviços rodando no host). Como o Floci serve todos os ALBs por um único socket por porta, a requisição escolhe a regra pelo cabeçalho `Host` ou pelo path. O certificado do ALB do Terraform é autoassinado para `localhost`; o curl confia nele pelo output do env `platform` ([ADR 0014](../../docs/adr/0014-meta-de-seguranca-a-antecipa-https-e-logs-do-alb.md)):

```bash
TF_DATA_DIR=tmp/terraform/infra-local-platform terraform -chdir=infra/terraform/envs/local/platform output -raw alb_certificate_pem > tmp/alb-ca.pem
curl -s -o /dev/null -w '%{http_code}\n' --cacert tmp/alb-ca.pem -H 'Host: example-go.playground.local' https://localhost:8443/health
curl -s -o /dev/null -w '%{http_code}\n' --cacert tmp/alb-ca.pem https://localhost:8443/example-quarkus
```

Listener em outra porta não é publicado: acrescente a porta em `docker-compose.yml`, ou chame de dentro da rede `playground-floci` (`http://floci:<porta>`). A mudança de porta só vale depois de recriar o container (`pnpm nx run infra-local:up`).

`FLOCI_LAMBDA_HOT_RELOAD=true` habilita criar funções com `S3Bucket=hot-reload` e `S3Key=<caminho absoluto no host>`, para o Floci montar o código direto do disco sem empacotar um zip.

## Limitações conhecidas

- **IAM não é aplicado.** Por padrão o Floci aceita qualquer chamada e não avalia policies: uma permissão faltando passa aqui e falha na AWS. Valide as policies fora do emulador.
- **CloudFormation aceita tipos não suportados em silêncio.** Um recurso sem implementação no Floci é "stubado": a stack chega a `CREATE_COMPLETE` sem criar nada (só um `WARN` no log do Floci). `FLOCI_CFN_ALLOW_STUBS=false` faz a stack falhar nesse caso.
- **O socket Docker equivale a root no host.** O Floci monta `/var/run/docker.sock` para criar os containers de Lambda, RDS e do console. Use só em máquina de desenvolvimento.
- **O console web não tem autenticação** e controla todos os serviços, por isso as portas 4566 e 4500 só publicam em `127.0.0.1`.
- A porta 4566 é fixa, então apenas uma instância do Floci roda por máquina; pare o Floci de outros projetos antes de subir este.
- O Floci emula parte do comportamento da AWS: limites, consistência e erros podem diferir. Teste em uma conta AWS real antes de promover.
