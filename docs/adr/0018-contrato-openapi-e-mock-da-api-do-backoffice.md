# ADR 0018: Contrato OpenAPI por documento inteiro e mock Mockoon da API do backoffice

- **Status**: Aceito
- **Data**: 2026-11-26

## Contexto

O painel `apps/backoffice` guardava tudo no `localStorage` e não fazia nenhuma chamada HTTP. O backend real fica para outra fase, porque será serverless, e o dono do projeto decidiu que isso não adia o frontend: a integração com a API, os estados de tela e o contrato entram agora, contra um servidor de mock em container.

Restrições:

- o Floci é o único ambiente AWS virtualizado ([ADR 0002](./0002-floci-ambiente-aws-local.md)), e um mock HTTP não pode virar emulador de AWS nem compose paralelo de serviços AWS;
- o motor de processos roda no painel (`src/shared/process`), e nenhum mock de prateleira o executa;
- o quadro grava a cada mudança, então duas abas ou duas pessoas no mesmo quadro precisam de controle de concorrência.

Os dois candidatos mais fortes a servidor de mock foram testados em container em 26/11/2026:

| Candidato          | Resultado                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MockServer 9.4.0   | **Reprovado.** O CRUD com parâmetro no `basePath` não casa a rota (502), o `PUT` ignora o `If-Match`, uma expectativa de 412 não tem prioridade sobre o CRUD e não há `ETag`. Usou 188 MB.                                                                                               |
| Mockoon CLI 9.10.0 | **Aprovado.** A rota CRUD com parâmetro responde, mas não separa a lista por pai. `ETag` e 412 saem da revisão gravada, o CORS é configurável no arquivo, e a API administrativa, com token, volta os dados ao estado inicial. A imagem não tem healthcheck, mas tem `node`. Usou 61 MB. |

## Decisão

**Contrato.** O contrato é o [`apps/backoffice-mock/openapi.yaml`](../../apps/backoffice-mock/openapi.yaml) (OpenAPI 3.1), **por documento inteiro**: o painel lê o documento, altera no navegador e grava o documento inteiro de volta.

- `BoardDocument` (`id`, `name`, `revision`, `schemaVersion`, `board`) em `/boards` e `/boards/{id}`, com `GET`, `POST`, `PUT` e `DELETE`.
- `ProcessDefinitionDocument` (`id`, `revision`, `schemaVersion`, `definition`) em `/process-definitions` e `/process-definitions/{id}`, com `GET`, `POST` e `PUT`. Não há `DELETE`, porque o catálogo só arquiva.
- **Concorrência otimista por revisão.** A leitura de um documento e toda gravação devolvem `ETag: "<revision>"`. O `PUT` exige `If-Match` com a revisão lida e leva no corpo a revisão lida mais 1; revisão diferente da gravada responde 412, e a falta do `If-Match`, 428. O painel lê a revisão do corpo do documento e usa o `ETag` como reserva.
- Toda recusa vem em Problem Details (`application/problem+json`): 400, 404, 412, 422, 428, 500 e 503. O `POST` com `id` repetido responde 422, porque o conjunto de erros não tem 409.
- Os schemas seguem os tipos do painel e são abertos: aceitam campo a mais e só anotam `format`. Para a divergência aparecer mesmo assim, os testes validam os dados iniciais e as amostras também contra uma cópia fechada do contrato.

**Mock.** O servidor é o **Mockoon CLI 9.10.0** em container, no projeto Nx `backoffice-mock` ([`apps/backoffice-mock`](../../apps/backoffice-mock/README.md)), com a imagem fixada por tag e digest e a porta 4010 publicada só em `127.0.0.1`. Ele fica fora do `infra/local`: é só HTTP, e o Floci segue como o único ambiente AWS virtualizado.

- O arquivo de ambiente do Mockoon é gerado a partir do contrato e dos dados iniciais; ninguém o edita à mão.
- O mock valida o nível de cima do documento e exige a revisão gravada mais 1; sem isso, um cliente que não incrementa a revisão nunca receberia 412.
- O `DELETE` responde 204 por um template próprio, porque a remoção nativa do CRUD do Mockoon responde 200 com `{}`.
- Latência e falha são simuladas só no mock, pelo cabeçalho `X-Mock-Scenario` (`slow`, `error` e `unavailable`), fora do contrato.
- O target `validate` é estático, porque o CI o roda em todo projeto afetado, sem container; a fumaça contra o container no ar é o target `smoke`.
- Os validadores são o Ajv e o `@seriousme/openapi-schema-validator`, pelo catálogo do pnpm.

**Conformidade nos dois sentidos.** O projeto do mock testa que os dados iniciais e as amostras gravadas pelos testes do painel validam contra o contrato, e que toda operação do contrato tem rota no mock. O painel testa que lê os dados iniciais do mock sem perda.

**Painel.** `NEXT_PUBLIC_API_URL` liga a API; sem ela, o painel continua no `localStorage`. Continuam só no navegador: qual quadro e qual processo estão abertos, as preferências de tela, a situação gravada para o diagrama da execução ([ADR 0017](./0017-diagrama-da-execucao-em-processos-execucao.md)) e a chave antiga do rascunho, usada só na migração.

- O quadro grava sozinho: a mudança vale na tela na hora e o documento é enviado logo depois. O processo é gravado pelos botões do editor.
- A API não avisa o que foi gravado em outro lugar. As telas releem quando a pessoa volta para a aba, e o que foi gravado sobre revisão antiga vira conflito, com a escolha entre recarregar do servidor e manter a versão da tela.

**E2E.** O e2e roda o painel contra o mock, que precisa estar no ar, e os jobs de e2e do CI o sobem. Como o estado do mock é um só, os testes rodam um por vez.

Alternativas descartadas:

- **Contrato por comandos**, com a lógica no servidor: o mock não executa o motor de processos, e as jornadas não rodariam.
- **Mock próprio em container** rodando o motor compartilhado: vira um protótipo de backend, fora desta fase.
- **Recursos granulares** (cards como sub-recurso do quadro): a rota CRUD do Mockoon não separa a lista por pai.
- Servidores descartados pela documentação, sem teste em container:
  - **Scalar Mock Server 0.2.86**: versão 0.x com release quase diário, e a lógica do mock (handlers em JavaScript) ficaria dentro do documento do contrato; o 412 só sairia por cabeçalho `Prefer`;
  - **Prism 5**: não guarda estado, e a imagem é só amd64;
  - **WireMock 3 de código aberto**: o CRUD é montado stub a stub, e o README remete o OpenAPI ao WireMock Cloud;
  - **json-server**: sem resposta condicional por cabeçalho e sem imagem oficial.

## Consequências

- **Ganhos**: o frontend entrega carregando, erro e conflito sem esperar o backend; o backend real nasce com um contrato já exercitado pelo painel e pelo e2e; os testes de conformidade acusam a mudança de formato do painel que o contrato não descreve.
- **Custos e riscos**:
  - gravar o documento inteiro faz qualquer mudança simultânea no mesmo quadro virar conflito, e o corpo cresce com o quadro (o mock aceita até 20 MB);
  - com a API, o quadro não tem cópia local: a mudança que ainda não chegou ao servidor se perde se a aba fechar, e por isso a página pede o aviso de saída do navegador enquanto há gravação pendente, com falha ou em conflito;
  - o mock não é o backend: a revisão vem do cliente, só o nível de cima do documento é validado, a conferência e a gravação não são atômicas, não há autenticação, o CORS libera qualquer origem e o estado some quando o container reinicia;
  - o e2e passa a depender de Docker e roda com um worker só;
  - o formato do arquivo do Mockoon muda entre versões maiores, então trocar a imagem pede regerar o arquivo e rodar a fumaça.
- **O que o backend real precisa garantir**: atribuir a revisão ele mesmo e compará-la com o `If-Match` na mesma gravação condicional; validar o corpo inteiro contra o contrato; autenticar, autorizar e restringir o CORS às origens do painel; responder em Problem Details também para rota inexistente e corpo grande demais; e devolver na lista de quadros pelo menos o resumo (`id`, `name` e `revision`).
- **Gatilho de revisão**: a chegada do backend real (o mock sai, o contrato e os testes de conformidade ficam), conflito frequente ou documento grande demais (pede operações granulares), ou autenticação no painel.
