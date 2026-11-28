# apps/backoffice-mock

Contrato da API do painel [`apps/backoffice`](../backoffice/README.md) e o servidor de mock dela. O contrato é o [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1). O mock é o [Mockoon CLI](https://mockoon.com/cli/) (MIT, versão fixada no `docker-compose.yml`) rodando em container, com estado em memória.

O backend real fica para outra fase. Até lá, o painel fala com este mock, e o contrato é a referência para os dois lados. O mock é só HTTP: não emula serviço da AWS e não faz parte do [`infra/local`](../../infra/local/README.md), onde o Floci continua sendo o único ambiente AWS virtualizado.

Pré-requisitos: Docker com Compose v2 e, para o `smoke`, `curl`.

## Subir e parar

Os comandos rodam pelo Nx, sem cache:

```bash
pnpm nx run backoffice-mock:up        # sobe o container e espera ficar saudável
pnpm nx run backoffice-mock:status    # situação do container
pnpm nx run backoffice-mock:logs      # segue os logs (uma linha JSON por requisição)
pnpm nx run backoffice-mock:reset     # volta os dados ao estado inicial, sem reiniciar
pnpm nx run backoffice-mock:smoke     # fumaça contra o container no ar
pnpm nx run backoffice-mock:down      # para e remove o container
pnpm nx run backoffice-mock:test      # testes de conformidade, sem container
pnpm nx run backoffice-mock:validate  # compose, scripts e .env, sem container
pnpm nx run backoffice-mock:generate-environment  # regrava o arquivo do Mockoon
```

Use sempre a forma `nx run projeto:target`: `nx reset` e `nx generate` são comandos do próprio Nx e não chamam os targets deste projeto.

O `smoke` confere, pelo endereço publicado, cada comportamento descrito abaixo e imprime o código de cada resposta. Ele volta os dados ao estado inicial no começo e no fim: não rode com dados que você queira manter no mock.

O `test` e o `validate` não precisam do container e rodam no CI com os outros projetos. O `smoke` precisa dele no ar, por isso tem nome próprio e fica fora do `nx affected -t validate`.

## Endereço e variáveis

O mock responde em `http://127.0.0.1:4010`, publicado só em loopback. O painel aponta para ele com `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010`.

Sem `.env`, o compose usa os padrões abaixo; para mudar, copie `.env.example` para `.env` (ignorado pelo git).

| Variável                      | Efeito                                                   | Padrão             |
| ----------------------------- | -------------------------------------------------------- | ------------------ |
| `BACKOFFICE_MOCK_PORT`        | Porta do host                                            | `4010`             |
| `BACKOFFICE_MOCK_ADMIN_TOKEN` | Token da API administrativa do Mockoon, local e fictício | `local-mock-token` |

## Contrato

Cada recurso é um documento inteiro, com `id` e `revision`. O painel gera os ids, lê o documento, altera no navegador e grava o documento inteiro de volta.

| Operação                        | Resposta de sucesso               |
| ------------------------------- | --------------------------------- |
| `GET /boards`                   | 200, lista de quadros             |
| `POST /boards`                  | 201, com `ETag`                   |
| `GET /boards/{id}`              | 200, com `ETag`                   |
| `PUT /boards/{id}`              | 200, com `ETag`; exige `If-Match` |
| `DELETE /boards/{id}`           | 204                               |
| `GET /process-definitions`      | 200, lista de definições          |
| `POST /process-definitions`     | 201, com `ETag`                   |
| `GET /process-definitions/{id}` | 200, com `ETag`                   |
| `PUT /process-definitions/{id}` | 200, com `ETag`; exige `If-Match` |

O catálogo de processos só arquiva, então não existe `DELETE` de definição.

A concorrência é otimista. A leitura de um documento e toda gravação devolvem `ETag: "<revision>"`. O `PUT` leva `If-Match: "<revisão lida>"` e, no corpo, `revision` igual à revisão lida mais 1; o `POST` leva `revision` 1. Toda recusa vem em `application/problem+json`. O mock confere a gravação nesta ordem:

| Situação                                                              | Resposta |
| --------------------------------------------------------------------- | -------- |
| `PUT` sem `If-Match`                                                  | 428      |
| Documento que não existe (`GET`, `PUT` ou `DELETE`)                   | 404      |
| `If-Match` diferente da revisão gravada                               | 412      |
| Corpo que não é JSON                                                  | 400      |
| Corpo sem os campos obrigatórios do nível de cima do documento        | 422      |
| `id` do corpo diferente do endereço, ou `id` que já existe no `POST`  | 422      |
| `revision` que não é a esperada (1 no `POST`, a lida mais 1 no `PUT`) | 422      |

## Dados iniciais

O mock sobe com o quadro padrão do painel (`board-1`, "Quadro principal") e o processo de exemplo já publicado (`process-1`, "Processo de exemplo", versão 1), os dois na revisão 1. Eles ficam em [`seed/boards.json`](./seed/boards.json) e [`seed/process-definitions.json`](./seed/process-definitions.json) e foram produzidos pelo código do próprio painel, que os lê sem perda.

Para mudar os dados iniciais, edite os arquivos de `seed/` e rode `pnpm nx run backoffice-mock:generate-environment`. Os dados não podem conter `{{`, que o Mockoon executaria como template.

## Voltar ao estado inicial

O estado fica em memória. Ele volta aos dados iniciais de três formas:

- `pnpm nx run backoffice-mock:reset`;
- `POST /mockoon-admin/data-buckets/purge` com `Authorization: Bearer <BACKOFFICE_MOCK_ADMIN_TOKEN>` (sem o token, 401), que é o que o `reset` e os testes de ponta a ponta usam;
- reiniciar o container.

## Cenários de teste

O cabeçalho `X-Mock-Scenario` simula lentidão e falha. Ele é só do mock e fica fora do contrato.

| Valor         | Efeito                                                             |
| ------------- | ------------------------------------------------------------------ |
| `slow`        | A resposta de sucesso demora 1,5 s; as recusas continuam imediatas |
| `error`       | 500 com Problem Details, sem ler nem gravar nada                   |
| `unavailable` | 503 com Problem Details, sem ler nem gravar nada                   |

## Operações só do mock

Ficam fora do contrato e existem para os testes e para a operação do container:

- `GET /health`: 200 enquanto o servidor está no ar; é o que o healthcheck do container chama.
- `PUT /boards` e `PUT /process-definitions`: trocam a coleção inteira pela lista de documentos do corpo. Servem para semear um teste numa chamada só, depois do purge. Corpo que não é lista de documentos: 422.
- `/mockoon-admin/*`: a API administrativa do Mockoon, protegida pelo token.

`PATCH`, `DELETE` de uma coleção e `DELETE` de definição são recusados com 405, porque a rota do Mockoon aceitaria mais do que o contrato prevê.

## Arquivo de ambiente do Mockoon

O [`mockoon/environment.json`](./mockoon/environment.json) é **gerado**: não edite à mão. Quem o monta é o `src/mockoon-environment.mjs`, a partir dos dados de `seed/`, do contrato e das respostas em `src/mockoon-refusals.mjs` (recusas) e `src/mockoon-responses.mjs` (sucessos). Depois de mudar qualquer um deles, rode `pnpm nx run backoffice-mock:generate-environment`; o `test` falha enquanto o arquivo versionado estiver desatualizado.

## Testes de conformidade

O `pnpm nx run backoffice-mock:test` roda sem container e confere que:

- o contrato é um OpenAPI 3.1 válido, e todo corpo descrito tem exemplo que valida contra o schema;
- os dados iniciais e toda amostra de `samples/*.json` validam contra os schemas do contrato e não usam campo que o contrato não descreve;
- toda operação do contrato tem rota no arquivo do Mockoon, e o arquivo versionado é o que o gerador produz;
- o compose fixa a imagem por digest, publica só em loopback e tem toda variável no `.env.example`.

Os schemas seguem os tipos do painel e não são mais restritos que a leitura dele: o contrato aceita campo a mais, não confere `format` e deixa aberto o que o painel lê de forma aberta, como os registros do histórico do card.

### Amostras gravadas pelo painel

A pasta `samples/` é gravada pelos testes do painel, com documentos produzidos pelo código dele, e não à mão. É assim que uma mudança de formato no painel aparece aqui como falha de contrato.

| Amostra                            | Teste do painel que a monta, em `apps/backoffice/src`     | O que ela traz                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `board-document.json`              | `app/(painel)/quadro/model/board-document-sample.spec.ts` | Um quadro em uso: card com processo em andamento, card filho de etapa, dependência, as regras do quadro, anexos, comentário e card arquivado |
| `process-definition-document.json` | `shared/process/definition-document-sample.spec.ts`       | Um processo com versão publicada e rascunho alterado depois dela, com aprovação, campos por etapa, decisão, paralelo e subprocesso           |

A amostra é conferida dos dois lados:

| Quem confere                  | O que confere                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| O teste da amostra, no painel | O documento que o código do painel monta hoje é igual ao arquivo, e o painel o relê sem perda |
| O `test` deste projeto        | O arquivo valida contra o schema do contrato e não usa campo que o contrato não descreve      |

Quando um dos dois falha:

| Falhou                               | Significa                                    | O que fazer                                                                             |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| O teste da amostra, no painel        | O painel passou a gravar outro formato       | Se a mudança é de propósito, regrave a amostra, como abaixo. Se não é, corrija o painel |
| O `test` deste projeto, numa amostra | O contrato não descreve o que o painel grava | Mude o `openapi.yaml`, com exemplo, e o mock se for o caso. Não corrija a amostra à mão |

Para regravar, rode o teste da amostra com `UPDATE_SAMPLES=1`, formate o arquivo e confira o contrato:

```bash
# amostra do quadro
UPDATE_SAMPLES=1 pnpm nx test backoffice --skip-nx-cache -- 'src/app/(painel)/quadro/model/board-document-sample.spec.ts'
pnpm exec biome format --write apps/backoffice-mock/samples/board-document.json

# amostra da definição de processo
UPDATE_SAMPLES=1 pnpm nx test backoffice --skip-nx-cache -- src/shared/process/definition-document-sample.spec.ts
pnpm exec biome format --write apps/backoffice-mock/samples/process-definition-document.json

pnpm nx run backoffice-mock:test
```

O teste compara o conteúdo, e não o texto do arquivo, então a formatação do Biome não o faz falhar. A mensagem de falha do teste da amostra repete estes comandos.

## Limites em relação a um backend real

- **A revisão vem do cliente.** O mock confere o `If-Match` e exige `revision` igual à gravada mais 1, mas grava o número que veio no corpo. O backend real precisa atribuir a revisão ele mesmo.
- **Só o nível de cima do documento é validado.** O conteúdo de `board` e de `definition` é gravado como veio. O backend real valida o corpo inteiro contra o contrato.
- **Não há autenticação nem autorização.** O CORS libera qualquer origem, o que só é aceitável porque a porta fica em loopback e os dados são fictícios.
- **A conferência e a gravação não são atômicas**, e o estado some quando o container reinicia.
- **`GET /boards` devolve os documentos inteiros**, e o contrato só garante o resumo de cada um.
- **Regra de negócio não é conferida**: nome repetido de quadro ou de processo, por exemplo, é barrado pelo painel, não pelo mock.
- **Duas respostas não seguem o Problem Details**: endereço sem rota (404 em HTML) e corpo acima de 20 MB (413 em texto), que vêm do próprio Mockoon.

## Atualizar a imagem

A imagem é fixada por tag e digest do índice multi-arch: atualize os dois juntos no `docker-compose.yml`. O formato do arquivo de ambiente muda entre versões maiores do Mockoon; depois de trocar a imagem, rode `pnpm nx run backoffice-mock:up` e `pnpm nx run backoffice-mock:smoke`.
