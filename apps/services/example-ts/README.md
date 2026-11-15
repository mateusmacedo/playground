# example-ts

[![Quality gate](https://sonarcloud.io/api/project_badges/measure?project=mateusmacedo_playground&metric=alert_status)](https://sonarcloud.io/summary/overall?id=mateusmacedo_playground) [Métricas desta pasta no SonarQube Cloud](https://sonarcloud.io/code?id=mateusmacedo_playground&selected=mateusmacedo_playground%3Aapps%2Fservices%2Fexample-ts)

Serviço serverless em TypeScript, HTTP acionado pelo API Gateway (HTTP API).

## Estrutura

- `src/core/`: caso de uso puro, sem tipos de `aws-lambda` nem de outro runtime.
- `src/entrypoints/lambda.ts`: handler da Lambda; só traduz o evento em chamada
  do núcleo e o resultado em resposta. O `serverless.yml` aponta para ele.
- `src/entrypoints/logger.ts`: log em JSON, uma linha por evento no stdout, com
  o nível de `LOG_LEVEL`. Só os entrypoints logam; o núcleo não. O `requestId`
  vem do logger (`withRequestId`), e campo fora da lista `safeKeys` sai como
  `[redacted]`: para logar um campo novo, inclua a chave na lista.

Um runtime novo (container, por exemplo) entra como outro arquivo em
`src/entrypoints/`, reaproveitando o mesmo núcleo.

## Comandos

```bash
pnpm nx test example-ts
pnpm nx typecheck example-ts
pnpm nx run example-ts:pre-deploy
pnpm nx run example-ts:deploy                  # Floci (configuration padrão)
pnpm nx run example-ts:deploy -c dev           # conta AWS, stage dev
pnpm nx run example-ts:invoke-local --function=handler
pnpm nx run example-ts:remove                  # Floci
```

Sem `-c`, os targets do Serverless usam a configuration `floci`, que aponta o
`AWS_ENDPOINT_URL` para `http://localhost:4566` com credenciais `test`. As
configurations `dev`, `homolog` e `prod` usam as credenciais AWS do ambiente.
A remoção em `prod` é bloqueada pelo plugin. O deploy em `prod` só roda no pipeline (`CI=true`) ou com `NX_SERVERLESS_ALLOW_PROD_DEPLOY=1`.

## Parâmetros

Os parâmetros por ambiente vêm do SSM, no caminho
`/playground/<stage>/<região>/example-ts/<recurso>/<atributo>`, com valor padrão
no próprio `serverless.yml`. No Floci, crie o parâmetro com:

```bash
aws --endpoint-url http://localhost:4566 ssm put-parameter \
  --name /playground/local/us-east-1/example-ts/config/log-level \
  --type String --value debug
```
