import { API_ERROR_MESSAGES } from '@/shared/api/api-result';
import type { BoardDocument } from '@/shared/api/contract';

import { type FakeBoardsApi, fakeBoardsApi } from './boards-api-fake';
import type { ProcessVersion } from './catalog';
import { TEST_CREATED_AT, testDefinition } from './catalog-test-data';
import {
  type FakeDefinitionsApi,
  fakeDefinitionsApi,
} from './definitions-api-fake';
import { begin } from './engine-test-kit';
import { linearPlan } from './engine-test-plans';
import { loadRemoteRunView } from './run-view-http';

const AT = '2026-11-26T12:00:00.000Z';

/** Execução parada na primeira etapa do roteiro em linha. */
const run = begin(linearPlan);

const version: ProcessVersion = {
  version: run.version,
  publishedAt: TEST_CREATED_AT,
  documentText: 'desenho publicado',
  plan: linearPlan,
};

const definition = testDefinition({
  id: run.definitionId,
  versions: [version],
});

const board: BoardDocument = {
  id: 'board-1',
  name: 'Quadro principal',
  revision: 4,
  schemaVersion: 3,
  board: {
    lanes: [
      {
        id: 'doing',
        cards: [
          { id: 'card-1', title: 'Atender o pedido', number: 1, process: run },
          { id: 'card-2', title: 'Sem processo', number: 2 },
        ],
      },
    ],
    config: { keyPrefix: 'QD' },
  },
};

interface Server {
  readonly boards: FakeBoardsApi;
  readonly processDefinitions: FakeDefinitionsApi;
}

function server(): Server {
  return {
    boards: fakeBoardsApi([board]),
    processDefinitions: fakeDefinitionsApi([definition]),
  };
}

function load(api: Server, cardId = 'card-1') {
  return loadRemoteRunView({
    api,
    ref: { boardId: 'board-1', cardId },
    at: AT,
  });
}

describe('fakeBoardsApi', () => {
  it('só simula a leitura de um quadro', async () => {
    const api = fakeBoardsApi([board]);

    expect(await api.list()).toMatchObject({
      ok: false,
      error: { kind: 'unexpected' },
    });
  });
});

describe('loadRemoteRunView', () => {
  it('monta a situação com o card do quadro e o desenho da versão do processo', async () => {
    const result = await load(server());

    expect(result).toEqual({
      kind: 'ready',
      view: {
        ref: 'board-1:card-1',
        definitionId: run.definitionId,
        version: run.version,
        processName: run.name,
        cardLabel: 'QD-1 Atender o pedido',
        backHref: '/quadro?quadro=board-1&card=QD-1',
        run,
        savedAt: AT,
      },
      version,
    });
  });

  it('lê o quadro e depois só a definição do processo da execução', async () => {
    const api = server();

    await load(api);

    expect(api.boards.reads).toEqual(['board-1']);
    expect(api.processDefinitions.calls).toEqual([
      { operation: 'get', id: run.definitionId },
    ]);
  });

  it('diz que o quadro não existe', async () => {
    const api = server();

    const result = await loadRemoteRunView({
      api,
      ref: { boardId: 'board-9', cardId: 'card-1' },
      at: AT,
    });

    expect(result).toEqual({ kind: 'no-board' });
  });

  it('devolve a falha com a mensagem da API quando o quadro não pode ser lido', async () => {
    const api = server();
    api.boards.failNext('network');

    expect(await load(api)).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.network,
    });
  });

  it('diz que o card não está no quadro, com a volta ao quadro', async () => {
    expect(await load(server(), 'card-9')).toEqual({
      kind: 'no-card',
      boardHref: '/quadro?quadro=board-1',
    });
  });

  it('diz que o card não tem processo, sem ler definição nenhuma', async () => {
    const api = server();

    const result = await load(api, 'card-2');

    expect(result).toEqual({
      kind: 'no-run',
      cardLabel: 'QD-2 Sem processo',
      backHref: '/quadro?quadro=board-1&card=QD-2',
    });
    expect(api.processDefinitions.calls).toEqual([]);
  });

  it('diz que falta o desenho quando o servidor não tem o processo', async () => {
    const api = server();
    api.processDefinitions.drop(run.definitionId);

    const result = await load(api);

    expect(result).toMatchObject({
      kind: 'no-version',
      view: { processName: run.name, version: run.version },
    });
  });

  it('diz que falta o desenho quando o processo não tem a versão da execução', async () => {
    const api = server();
    api.processDefinitions.put({ ...definition, versions: [] });

    expect(await load(api)).toMatchObject({ kind: 'no-version' });
  });

  it('devolve a falha com a mensagem da API quando a definição não pode ser lida', async () => {
    const api = server();
    api.processDefinitions.failNext({ operation: 'get', kind: 'timeout' });

    expect(await load(api)).toEqual({
      kind: 'failed',
      message: API_ERROR_MESSAGES.timeout,
    });
  });
});
