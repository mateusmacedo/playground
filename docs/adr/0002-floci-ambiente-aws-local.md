# ADR 0002: Floci como único ambiente AWS virtualizado local

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

Os serviços do monorepo serão serverless na AWS: Lambda, API Gateway, SQS, SNS, S3, DynamoDB, SSM e afins. Para desenvolver e testar sem conta AWS e sem custo, precisamos de um emulador local. Manter vários ao mesmo tempo (um para filas, outro para funções, outro para tabelas) gera comportamentos divergentes entre si e da nuvem, e cada pessoa acaba com um ambiente diferente.

Queremos uma regra simples: **o que roda no ambiente local roda igual na AWS**.

## Decisão

- Adotar o **Floci** como **único** ambiente AWS virtualizado local: um emulador compatível com a API do LocalStack, no endpoint `http://localhost:4566`, com console web em `http://localhost:4566/_floci/ui`.
- Ele vive em `infra/local`, como o projeto Nx `infra-local`, com os targets `up`, `down`, `reset`, `logs`, `status` e `validate`.
- O `docker-compose.yml` publica a porta só em `127.0.0.1` (o Floci aceita qualquer chamada sem autenticação), fixa as imagens por tag **e** digest e usa uma rede Docker nomeada (`playground-floci`), para os containers filhos (Lambda, por exemplo) caírem sempre na mesma rede do Floci.
- Um **bootstrap idempotente** (container `floci-bootstrap`, com AWS CLI) cria os recursos iniciais: buckets S3, filas SQS com DLQ, tabelas DynamoDB mínimas e parâmetros SSM. Novos seeds entram como scripts `NN-nome.sh` em `infra/local/init/floci`.
- Os parâmetros SSM seguem o caminho canônico `/playground/local/<região>/<domínio>/<recurso>/<atributo>` (por exemplo `/playground/local/us-east-1/backoffice/app/name`), o mesmo formato que a infraestrutura de nuvem deve publicar ([ADR 0004](./0004-serverless-e-terraform.md)).
- Credenciais são fictícias (`test`/`test`), conta `000000000000`, região padrão `us-east-1`.
- **Alcance**: tudo roda no Floci localmente, **inclusive a implantação do frontend** como se fosse na AWS, e os destinos de container do [ADR 0008](./0008-adapters-de-runtime.md) (EC2, ECS e EKS). Segundo a documentação do Floci, as instâncias EC2 são containers Docker, as tasks ECS rodam como containers reais, o EKS sobe clusters k3s, o ALB e o NLB encaminham tráfego, o CloudFront encaminha para as origens e as Lambda Web Functions encaminham requisições. Isso vem do branch `main` da documentação e **ainda não foi testado na versão 2.4.0** fixada aqui: só o caminho Lambda foi exercitado.
- **Plataforma local**: quando o Terraform existir, o `envs/local` dele (com o provider apontando para o Floci) cria a plataforma local, e o bootstrap de `infra/local` fica só com o que o Terraform não fizer no emulador ([ADR 0004](./0004-serverless-e-terraform.md)). Hoje o bootstrap faz tudo.
- Não adicionar nenhum outro emulador AWS ao repositório.

## Consequências

- **Ganhos**: um único comando (`pnpm nx up infra-local`) deixa o ambiente pronto e igual para todo mundo; configuração de serviço e de stage `local` é a mesma da nuvem, trocando só o endpoint e os valores.
- **Custos**: exige Docker. O Floci monta `/var/run/docker.sock` para criar os containers de Lambda, o que equivale a acesso de root no host: use só em máquina de desenvolvimento.
- **Limites da emulação**: nenhum emulador tem paridade total. Recurso que o Floci não suporta vira **aviso** no bootstrap, sem abortar. Diferenças descobertas devem ser registradas no [guia do ambiente local](../onboarding/local-aws-floci.md). Dois exemplos já conhecidos: o IAM não é aplicado (uma permissão faltando só aparece na AWS) e o CloudFormation aceita em silêncio recursos que o Floci não implementa. A validação final é na AWS, depois que o deploy existir (roadmap).
- **Estado**: por padrão o armazenamento é persistente (volume `floci-data`). `pnpm nx reset infra-local` apaga o volume e recria tudo do zero.
- **Gatilho de revisão**: o Floci deixar de ser mantido, ou uma lacuna de paridade bloquear um serviço do roadmap.
