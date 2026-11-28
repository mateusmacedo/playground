import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import type { ProcessCatalog } from '@/shared/process/catalog';
import type { CatalogStore } from '@/shared/process/catalog-store';
import {
  TEST_CREATED_AT,
  testDefinition,
} from '@/shared/process/catalog-test-data';
import { begin } from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessRun } from '@/shared/process/run';
import type { RunView, RunViewStore } from '@/shared/process/run-view-store';

import { DOCUMENT_VERSION } from '../model/document';
import { serializeDocument } from '../model/draft';
import { block, link } from '../model/test-graph';
import { mockReactFlow } from '../react-flow-test-setup';
import { RunDiagram } from './run-diagram';

mockReactFlow();

const REF = 'board-1:card-1';
const SAVED_AT = '2026-11-26T12:00:00.000Z';

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

const catalogWithVersion: ProcessCatalog = {
  definitions: [
    testDefinition({
      id: run.definitionId,
      versions: [
        {
          version: run.version,
          publishedAt: TEST_CREATED_AT,
          documentText,
          plan: linearPlan,
        },
      ],
    }),
  ],
};

function viewOf(overrides: Partial<RunView> = {}): RunView {
  return {
    ref: REF,
    definitionId: run.definitionId,
    version: run.version,
    processName: 'Atendimento',
    cardLabel: 'QD-1 Atender o pedido',
    backHref: '/quadro?card=QD-1',
    run,
    savedAt: SAVED_AT,
    ...overrides,
  };
}

/** Porta da situação com no máximo uma situação gravada. */
function runViewStore(view: RunView | null): RunViewStore {
  return {
    load: (ref) => (view !== null && view.ref === ref ? view : null),
    save: () => true,
  };
}

/** Porta do catálogo que só lê o catálogo dado. */
function catalogStore(catalog: ProcessCatalog | null): CatalogStore {
  const save = async () => ({ ok: true }) as const;
  return {
    load: async () => ({ ok: true, catalog }),
    save,
    overwrite: save,
    subscribe: () => () => undefined,
  };
}

interface DiagramParams {
  readonly view?: RunView | null;
  readonly catalog?: ProcessCatalog | null;
}

function diagram(params: DiagramParams = {}) {
  const { view = viewOf(), catalog = catalogWithVersion } = params;
  return (
    <RunDiagram
      store={runViewStore(view)}
      catalogStore={catalogStore(catalog)}
    />
  );
}

function openAddress(search: string): void {
  window.history.replaceState(null, '', `/processos/execucao${search}`);
}

function backLink(name: string) {
  return screen.getByRole('link', { name });
}

describe('RunDiagram', () => {
  beforeEach(() => {
    openAddress(`?ref=${REF}`);
  });

  afterEach(() => {
    openAddress('');
  });

  it('na primeira renderização, igual à do servidor, mostra o carregamento', () => {
    const html = renderToString(diagram());

    expect(html).toContain('Carregando a execução');
  });

  it('sem a referência no endereço, explica e oferece a volta ao quadro', async () => {
    openAddress('');

    render(diagram());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nenhuma execução foi indicada.',
    );
    expect(backLink('Voltar ao quadro').getAttribute('href')).toBe('/quadro');
  });

  it('sem situação gravada para a referência, explica e oferece a volta ao quadro', async () => {
    render(diagram({ view: null }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'A situação desta execução não está neste navegador.',
    );
    expect(backLink('Voltar ao quadro').getAttribute('href')).toBe('/quadro');
  });

  it('sem o desenho da versão no catálogo, explica e oferece a volta ao card', async () => {
    render(diagram({ catalog: null }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'O desenho da versão 1 de Atendimento não está neste navegador.',
    );
    expect(backLink('Voltar ao card').getAttribute('href')).toBe(
      '/quadro?card=QD-1',
    );
  });

  it('com a versão de outro número no catálogo, não mostra o desenho errado', async () => {
    render(
      diagram({ view: viewOf({ version: 2, run: { ...run, version: 2 } }) }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'O desenho da versão 2 de Atendimento não está neste navegador.',
    );
  });

  it('mostra o processo, a versão, o card, a hora da situação e a volta ao card', async () => {
    render(diagram());

    expect(
      await screen.findByRole('heading', { name: 'Atendimento' }),
    ).toBeTruthy();
    expect(screen.getByText('Versão 1')).toBeTruthy();
    expect(screen.getByText('Em andamento')).toBeTruthy();
    expect(screen.getByText('QD-1 Atender o pedido')).toBeTruthy();
    expect(document.querySelector('time')?.getAttribute('dateTime')).toBe(
      SAVED_AT,
    );
    expect(backLink('Voltar ao card').getAttribute('href')).toBe(
      '/quadro?card=QD-1',
    );
  });

  it('destaca no desenho os estados calculados a partir da execução', async () => {
    render(diagram());

    expect(
      await screen.findByRole('group', { name: 'Início, concluída' }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('group', { name: 'Etapa: Separar, etapa atual' }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('group', { name: 'Etapa: Entregar' }),
    ).toBeTruthy();
  });

  it('diz o desfecho da execução encerrada', async () => {
    const cancelled: ProcessRun = { ...run, status: 'cancelled', tokens: [] };

    render(diagram({ view: viewOf({ run: cancelled }) }));

    expect(await screen.findByText('Cancelada')).toBeTruthy();
  });
});
