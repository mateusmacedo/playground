# Guia: API do backoffice e o mock

O painel [`apps/backoffice`](../../apps/backoffice/README.md) guarda quadros e definições de processo no navegador ou, com `NEXT_PUBLIC_API_URL`, numa API HTTP. O backend real fica para outra fase; até lá, quem responde é um servidor de mock em container, e o contrato OpenAPI é a referência dos dois lados ([ADR 0018](../adr/0018-contrato-openapi-e-mock-da-api-do-backoffice.md)).

| O quê                             | Onde                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Contrato (OpenAPI 3.1)            | [`apps/backoffice-mock/openapi.yaml`](../../apps/backoffice-mock/openapi.yaml)                                                    |
| Mock (Mockoon CLI em container)   | [`apps/backoffice-mock`](../../apps/backoffice-mock/README.md): targets, variáveis, dados iniciais, operações só do mock, limites |
| Cliente HTTP do painel            | `apps/backoffice/src/shared/api`                                                                                                  |
| Apoio dos testes de ponta a ponta | `apps/backoffice-e2e/src/support`                                                                                                 |

O mock é só HTTP: não emula serviço da AWS e fica fora do `infra/local`, onde o Floci segue como o único ambiente AWS virtualizado.

## Subir o mock

Precisa de Docker com Compose v2.

```bash
pnpm nx run backoffice-mock:up       # sobe o container e espera ficar saudável
pnpm nx run backoffice-mock:status   # situação do container
pnpm nx run backoffice-mock:reset    # volta os dados ao estado inicial
pnpm nx run backoffice-mock:down     # para e remove o container
```

Ele responde em `http://127.0.0.1:4010`, só em loopback, com um quadro e um processo de exemplo. O estado fica em memória e volta ao inicial quando o container reinicia. Use sempre a forma `nx run backoffice-mock:<target>`: `nx reset` é um comando do próprio Nx.

## Ligar o painel à API

A variável `NEXT_PUBLIC_API_URL` liga a API. Em `apps/backoffice/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:4010
```

- O valor é um endereço `http` ou `https`, sem usuário, senha, query nem fragmento. Outro valor falha o build, como acontece com um `NEXT_PUBLIC_STAGE` inválido.
- A variável entra no bundle no build: depois de mudar, reinicie o `pnpm nx dev backoffice` ou refaça o build. O cache do Nx separa o build com a variável do build sem ela.
- Ela é pública, como toda `NEXT_PUBLIC_*`: nunca leva segredo.

## Com e sem a API

|                                  | Sem `NEXT_PUBLIC_API_URL`                                                                             | Com `NEXT_PUBLIC_API_URL`                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Quadros e definições de processo | `localStorage` do navegador                                                                           | API, um documento inteiro por quadro e por processo                                          |
| Gravação do quadro               | Na hora, a cada mudança                                                                               | A mudança vale na tela na hora e é enviada 400 ms depois da última                           |
| Gravação do processo             | Em "Salvar rascunho", em "Publicar versão" e a cada ação do catálogo, como criar, renomear e arquivar | Nos mesmos momentos                                                                          |
| Mudança feita em outro lugar     | Só alcança as abas do mesmo navegador                                                                 | A tela relê ao voltar para a aba; a gravação sobre revisão antiga recebe 412 e vira conflito |
| Falha ao ler ou gravar           | Armazenamento bloqueado ou cheio                                                                      | Sem rede, tempo esgotado (10 s), recusa ou erro do servidor                                  |

Nos dois modos ficam só no navegador: qual quadro e qual processo estão abertos, o tema, as preferências de tela e a situação que o quadro guarda para o diagrama da execução.

O painel não chama `fetch` espalhado pelo código. As telas pedem a API por `usePanelApi()` (`src/shared/api/panel-api-context.tsx`), que devolve `null` quando a variável não está definida, e todo erro volta como valor, com o tipo da falha e a mensagem pronta para a tela.

A concorrência é otimista. O painel guarda a revisão do documento que leu e a manda no `If-Match` ao gravar; se alguém gravou antes, a API responde 412 e a tela entra em conflito, em vez de sobrescrever em silêncio.

O que cada tela mostra com a API (carregando, erro de leitura com nova tentativa, falha de gravação e conflito, com os botões de cada aviso) e o aviso de saída do quadro estão no [`README.md` do painel](../../apps/backoffice/README.md#estados-de-tela-com-a-api).

### Releitura ao voltar para a aba

A API não avisa o que foi gravado em outro lugar. Com a API ligada, a tela relê do servidor quando a pessoa volta para a aba, depois de ter saído dela:

| Tela                                      | O que é relido                       | Quando não relê                                                                        |
| ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Quadro                                    | A lista de quadros e o quadro aberto | Enquanto há mudança por gravar; a lista, também enquanto um quadro está sendo excluído |
| Editor                                    | O catálogo de processos              | Enquanto o desenho tem alteração não salva                                             |
| Lista de execuções e diagrama da execução | Os quadros, e o processo no diagrama | Enquanto uma leitura ainda está em andamento                                           |

O que mudou em outro lugar e não foi relido aparece como conflito na gravação seguinte. Sem a API não há releitura: a mudança de outra aba chega pelo próprio navegador.

### "Ver diagrama" com a API

O link "Ver diagrama" de um card abre uma página que lê o quadro do servidor. Por isso ele envia a mudança pendente e espera a resposta ("Gravando o quadro antes de abrir…") antes de seguir. Se a gravação falha ou entra em conflito, o diagrama não abre, e o aviso acima do quadro diz o motivo. O clique que abre o link em outra aba não espera a gravação, e a outra aba pode abrir com a situação anterior.

## Simular lentidão e falha

O cabeçalho `X-Mock-Scenario` existe só no mock e fica fora do contrato. O painel nunca o envia.

| Valor         | Efeito                                     |
| ------------- | ------------------------------------------ |
| `slow`        | A resposta de sucesso demora 1,5 s         |
| `error`       | 500 em Problem Details, sem ler nem gravar |
| `unavailable` | 503 em Problem Details, sem ler nem gravar |

```bash
curl -i -H 'X-Mock-Scenario: unavailable' http://127.0.0.1:4010/boards
```

## Testes de ponta a ponta contra o mock

O e2e sobe o painel com `NEXT_PUBLIC_API_URL` apontando para o mock e exige o mock no ar: sem ele, a execução para antes do primeiro teste e diz como subir.

```bash
pnpm nx run backoffice-mock:up
pnpm nx e2e backoffice-e2e
```

- O estado do mock é um só, então os testes rodam **um por vez**.
- Um servidor do painel já aberto na porta 3000 é reaproveitado. Ele precisa ter sido iniciado com `NEXT_PUBLIC_API_URL`; se não foi, pare-o antes de rodar o e2e.
- Quem muda `BACKOFFICE_MOCK_PORT` ou `BACKOFFICE_MOCK_ADMIN_TOKEN` no `.env` do mock exporta os mesmos valores para o e2e.

O spec que depende dos dados da API importa o `test` de `src/support/mock-test.ts`. Com ele, o mock volta aos dados iniciais antes de cada teste, e o teste recebe dois apoios:

| Apoio          | O que faz                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mock`         | `seedBoard` e `seedDefinition` gravam um documento pelos endpoints do contrato; `readBoard` e `readDefinition` leem o que está gravado |
| `mockScenario` | `start('slow' \| 'error' \| 'unavailable')` liga o cenário só nas chamadas da página à API; `stop()` desliga                           |

```ts
import { expect } from '@playwright/test';

import { test } from './support/mock-test';

test('mostra o quadro semeado', async ({ page, mock }) => {
  await mock.seedBoard({
    id: 'board-1',
    name: 'Quadro principal',
    schemaVersion: 3,
    board: {
      lanes: [
        {
          id: 'todo',
          title: 'A fazer',
          cards: [{ id: 'card-1', title: 'Card semeado', number: 1 }],
        },
      ],
      archive: [],
      labels: [],
      nextNumber: 2,
      config: { keyPrefix: 'QD' },
    },
  });

  await page.goto('/quadro');

  await expect(
    page.getByRole('heading', { name: 'Card semeado' }),
  ).toBeVisible();
});
```

A semeadura cria o documento que não existe e regrava o que existe, sobre a revisão gravada. Semear no meio do teste, com a tela aberta, é a forma de simular a gravação de outra pessoa: a próxima gravação do painel recebe o conflito.

O `localStorage` continua sendo o lugar de semear o que é só do navegador, como o tema.

## No CI

Os jobs de e2e do `ci.yml` e do `release.yml` sobem o mock antes dos testes, mostram o log dele quando o e2e falha e o derrubam no fim. O `test` e o `validate` do projeto `backoffice-mock` não precisam do container e rodam com os outros projetos.

## Mudar a API

O contrato manda: operação, campo ou erro novo entra primeiro no `openapi.yaml`, e só depois no mock e no painel. O passo a passo e as regras do contrato estão no [`README.md`](../../apps/backoffice-mock/README.md) e no [`AGENTS.md`](../../apps/backoffice-mock/AGENTS.md) do projeto do mock.
