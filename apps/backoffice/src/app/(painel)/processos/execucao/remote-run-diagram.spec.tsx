import { act, fireEvent, render, screen } from '@testing-library/react';
import { Activity } from 'react';

import type { BoardDocument } from '@/shared/api/contract';
import type { PanelApi } from '@/shared/api/panel-api';
import { PanelApiProvider } from '@/shared/api/panel-api-context';
import { fakeBoardsApi } from '@/shared/process/boards-api-fake';
import {
  TEST_CREATED_AT,
  testDefinition,
} from '@/shared/process/catalog-test-data';
import { fakeDefinitionsApi } from '@/shared/process/definitions-api-fake';
import { begin } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessRun } from '@/shared/process/run';

import { DOCUMENT_VERSION } from '../model/document';
import { serializeDocument } from '../model/draft';
import { block, link } from '../model/test-graph';
import { mockReactFlow } from '../react-flow-test-setup';
import { RunDiagram } from './run-diagram';

mockReactFlow();

/** Execução parada na etapa `a` do roteiro em linha (start > a > b > end). */
const run = begin(linearPlan);

/** Desenho publicado com os mesmos ids do roteiro em linha. */
const documentText = serializeDocument({
  version: DOCUMENT_VERSION,
  lanes: [],
  graph: {
    nodes: [
      block({ id: 'start', type: 'start', data: { label: 'Início' } }),
      block({ id: 'a', type: 'task', data: { label: 'Separar' } }),
      block({ id: 'b', type: 'task', data: { label: 'Entregar' } }),
      block({ id: 'end', type: 'end', data: { label: 'Fim' } }),
    ],
    edges: [
      link({ source: 'start', target: 'a' }),
      link({ source: 'a', target: 'b' }),
      link({ source: 'b', target: 'end' }),
    ],
  },
});

const definition = testDefinition({
  id: run.definitionId,
  versions: [
    {
      version: run.version,
      publishedAt: TEST_CREATED_AT,
      documentText,
      plan: linearPlan,
    },
  ],
});

function boardWith(process: ProcessRun | undefined): BoardDocument {
  return {
    id: 'board-1',
    name: 'Quadro principal',
    revision: 1,
    schemaVersion: 3,
    board: {
      lanes: [
        {
          id: 'doing',
          cards: [
            { id: 'card-1', title: 'Atender o pedido', number: 1, process },
          ],
        },
      ],
      config: { keyPrefix: 'QD' },
    },
  };
}

function server() {
  return {
    boards: fakeBoardsApi([boardWith(run)]),
    processDefinitions: fakeDefinitionsApi([definition]),
  };
}

function openAddress(search: string): void {
  window.history.replaceState(null, '', `/processos/execucao${search}`);
}

function renderDiagram(api = server()) {
  render(
    <PanelApiProvider value={api}>
      <RunDiagram />
    </PanelApiProvider>,
  );
  return api;
}

interface RouteProps {
  readonly visible: boolean;
  readonly api: PanelApi;
}

/** Rota que o Next esconde ao navegar para outra, sem desmontar. */
function Route({ visible, api }: RouteProps) {
  return (
    <Activity mode={visible ? 'visible' : 'hidden'}>
      <PanelApiProvider value={api}>
        <RunDiagram />
      </PanelApiProvider>
    </Activity>
  );
}

async function alertText() {
  return (await screen.findByRole('alert')).textContent;
}

function backLink(name: string) {
  return screen.getByRole('link', { name });
}

/** A pessoa sai da aba e volta para ela. */
async function leaveAndComeBack() {
  await act(async () => {
    fireEvent.blur(window);
    fireEvent.focus(window);
  });
}

describe('RunDiagram com a API do painel', () => {
  beforeEach(() => {
    openAddress('?ref=board-1:card-1');
  });

  afterEach(() => {
    openAddress('');
  });

  it('mostra o carregamento enquanto a API não responde', async () => {
    renderDiagram();

    expect(screen.getByText('Carregando a execução…')).toBeTruthy();
    await screen.findByRole('heading', { name: run.name });
  });

  it('mostra a situação lida do quadro sobre o desenho lido da definição', async () => {
    renderDiagram();

    expect(await screen.findByRole('heading', { name: run.name })).toBeTruthy();
    expect(screen.getByText('Versão 1')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.getByText('QD-1 Atender o pedido')).toBeTruthy();
    expect(backLink('Voltar ao card').getAttribute('href')).toBe(
      '/quadro?quadro=board-1&card=QD-1',
    );
    expect(
      await screen.findByRole('group', { name: 'Etapa: Separar, etapa atual' }),
    ).toBeTruthy();
  });

  it('sem a referência no endereço, explica e oferece a volta ao quadro', async () => {
    openAddress('');

    const api = renderDiagram();

    expect(await alertText()).toContain('Nenhuma execução foi indicada.');
    expect(backLink('Voltar ao quadro').getAttribute('href')).toBe('/quadro');
    expect(api.boards.reads).toEqual([]);
  });

  it('com a referência incompleta, explica como a que falta', async () => {
    openAddress('?ref=board-1');

    renderDiagram();

    expect(await alertText()).toContain('Nenhuma execução foi indicada.');
  });

  it('quando a leitura falha, mostra o motivo e lê de novo ao tentar', async () => {
    const api = server();
    api.boards.failNext('network');
    renderDiagram(api);
    expect(await alertText()).toContain(
      'Não foi possível carregar a execução.',
    );
    expect(await alertText()).toContain(
      'Não foi possível falar com o servidor',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { name: run.name })).toBeTruthy();
  });

  it('explica quando o quadro não existe mais', async () => {
    openAddress('?ref=board-9:card-1');

    renderDiagram();

    expect(await alertText()).toContain(
      'O quadro desta execução não foi encontrado.',
    );
    expect(backLink('Voltar ao quadro').getAttribute('href')).toBe('/quadro');
  });

  it('explica quando o card não está mais no quadro e volta ao quadro dele', async () => {
    openAddress('?ref=board-1:card-9');

    renderDiagram();

    expect(await alertText()).toContain(
      'O card desta execução não está mais no quadro.',
    );
    expect(backLink('Voltar ao quadro').getAttribute('href')).toBe(
      '/quadro?quadro=board-1',
    );
  });

  it('explica quando o card não tem mais processo e volta ao card', async () => {
    const api = server();
    api.boards.put(boardWith(undefined));

    renderDiagram(api);

    expect(await alertText()).toContain(
      'O card QD-1 Atender o pedido não tem processo em execução.',
    );
    expect(backLink('Voltar ao card').getAttribute('href')).toBe(
      '/quadro?quadro=board-1&card=QD-1',
    );
  });

  it('explica quando o servidor não tem o desenho da versão', async () => {
    const api = server();
    api.processDefinitions.drop(run.definitionId);

    renderDiagram(api);

    expect(await alertText()).toContain(
      `O desenho da versão 1 de ${run.name} não está no servidor.`,
    );
    expect(backLink('Voltar ao card')).toBeTruthy();
  });

  it('relê a situação quando a pessoa volta para a aba, sem trocar a tela pelo carregamento', async () => {
    const api = renderDiagram();
    await screen.findByText('Em andamento');
    api.boards.put(boardWith({ ...run, status: 'cancelled', tokens: [] }));

    await leaveAndComeBack();

    expect(await screen.findByText('Cancelada')).toBeTruthy();
    expect(screen.queryByText('Carregando a execução…')).toBeNull();
  });

  it('mantém a situação na tela quando a releitura da volta falha', async () => {
    const api = renderDiagram();
    await screen.findByText('Em andamento');
    api.boards.failNext('network');

    await leaveAndComeBack();

    expect(api.boards.reads).toHaveLength(2);
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não pede outra leitura na volta enquanto a primeira não terminou', async () => {
    const api = renderDiagram();

    await leaveAndComeBack();
    await screen.findByText('Em andamento');

    expect(api.boards.reads).toHaveLength(1);
  });

  it('lê o endereço novo quando a rota escondida reaparece, e descarta a resposta do pedido anterior', async () => {
    const api = server();
    const { rerender } = render(<Route visible api={api} />);
    openAddress('?ref=board-1:card-9');
    rerender(<Route visible={false} api={api} />);

    rerender(<Route visible api={api} />);

    expect(await alertText()).toContain(
      'O card desta execução não está mais no quadro.',
    );
    expect(api.boards.reads).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: run.name })).toBeNull();
  });
});
