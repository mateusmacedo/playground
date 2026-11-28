import { fireEvent, render, screen, within } from '@testing-library/react';

import type { StepState } from '@/shared/process/engine-states';
import { type ExitKey, exitKey, type StepRef } from '@/shared/process/plan';

import type { GraphNode } from '../model/blocks';
import {
  DOCUMENT_VERSION,
  type Lane,
  type ProcessDocument,
} from '../model/document';
import { serializeDocument } from '../model/draft';
import { block, link } from '../model/test-graph';
import { mockReactFlow } from '../react-flow-test-setup';
import { ProcessRunViewer } from './process-run-viewer';

mockReactFlow();

const billing = block({
  id: 'billing',
  type: 'subprocess',
  data: {
    label: 'Cobrança',
    process: {
      nodes: [
        block({ id: 'charge', type: 'task', data: { label: 'Cobrar' } }),
        block({ id: 'paid', type: 'end', data: { label: 'Pago' } }),
      ],
      edges: [link({ source: 'charge', target: 'paid' })],
    },
  },
});

const late: GraphNode = {
  ...block({ id: 'late', type: 'exception', data: { label: 'Atrasou' } }),
  parentId: 'review',
};

const lanes: Lane[] = [{ id: 'lane-1', name: 'Financeiro', width: 256 }];

interface DrawingParams {
  readonly nodes?: readonly GraphNode[];
  readonly lanes?: Lane[];
}

/** Texto publicado de um desenho: início, análise (com exceção), o subprocesso de cobrança e o fim. */
function drawingText(params: DrawingParams = {}): string {
  const document: ProcessDocument = {
    version: DOCUMENT_VERSION,
    lanes: params.lanes ?? [],
    graph: {
      nodes: params.nodes ?? [
        block({ id: 'start', type: 'start', data: { label: 'Início' } }),
        block({ id: 'review', type: 'task', data: { label: 'Analisar' } }),
        late,
        billing,
        block({ id: 'end', type: 'end', data: { label: 'Fim' } }),
      ],
      edges: [
        link({ source: 'start', target: 'review' }),
        link({ source: 'review', target: 'billing' }),
        link({ source: 'billing', target: 'end' }),
        link({ source: 'late', target: 'end' }),
      ],
    },
  };
  return serializeDocument(document);
}

interface ViewerParams {
  readonly documentText?: string;
  readonly states?: Readonly<Record<StepRef, StepState>>;
  readonly taken?: readonly ExitKey[];
}

function viewer(params: ViewerParams = {}) {
  const { documentText = drawingText(), states = {}, taken = [] } = params;
  return (
    <ProcessRunViewer
      documentText={documentText}
      states={new Map(Object.entries(states))}
      takenExits={new Set(taken)}
    />
  );
}

function diagram() {
  return screen.getByLabelText('Diagrama da execução');
}

/** O bloco pelo nome que o leitor de tela anuncia, já desenhado. */
function findBlock(name: string) {
  return screen.findByRole('group', { name });
}

describe('ProcessRunViewer', () => {
  it('nomeia cada bloco com o estado da etapa na execução', async () => {
    render(
      viewer({
        states: { start: 'done', review: 'active', billing: 'waiting' },
      }),
    );

    expect(await findBlock('Início, concluída')).toBeTruthy();
    expect(await findBlock('Etapa: Analisar, etapa atual')).toBeTruthy();
    expect(await findBlock('Subprocesso: Cobrança, em espera')).toBeTruthy();
  });

  it('deixa sem estado o bloco que a execução ainda não alcançou', async () => {
    render(viewer({ states: { start: 'done' } }));

    expect(await findBlock('Fim')).toBeTruthy();
  });

  it('mostra no bloco o selo com o nome do estado, além da cor', async () => {
    render(viewer({ states: { review: 'active' } }));

    const review = await findBlock('Etapa: Analisar, etapa atual');
    expect(within(review).getByText('Etapa atual')).toBeTruthy();
  });

  it('marca o Evento de exceção por onde a execução desviou', async () => {
    render(viewer({ taken: [exitKey({ stepRef: 'review', exitId: 'late' })] }));

    const raised = await findBlock(
      'Evento de exceção: Atrasou, exceção acionada',
    );
    expect(within(raised).getByText('Exceção acionada')).toBeTruthy();
  });

  it('diz no nome da conexão que a execução passou por ela', async () => {
    render(viewer({ taken: [exitKey({ stepRef: 'start', exitId: 'out' })] }));

    expect(
      await screen.findByRole('group', {
        name: 'Conexão de Início para Analisar, caminho percorrido',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Conexão de Analisar para Cobrança' }),
    ).toBeTruthy();
  });

  it('explica as marcas na legenda', () => {
    render(viewer());

    const legend = screen.getByRole('list', { name: 'Legenda do diagrama' });
    expect(within(legend).getByText('Etapa atual')).toBeTruthy();
    expect(within(legend).getByText('Em espera')).toBeTruthy();
    expect(within(legend).getByText('Concluída')).toBeTruthy();
    expect(within(legend).getByText('Exceção acionada')).toBeTruthy();
    expect(within(legend).getByText('Caminho percorrido')).toBeTruthy();
    expect(within(legend).getByText('Sem selo')).toBeTruthy();
  });

  it('não oferece nenhuma ação de edição', async () => {
    render(viewer());
    await findBlock('Etapa: Analisar');

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('button', { name: /Inserir bloco/ })).toBeNull();
    expect(screen.queryByText('Biblioteca de blocos')).toBeNull();
  });

  it('oferece ajustar o diagrama à tela', async () => {
    render(viewer());
    await findBlock('Etapa: Analisar');

    const fit = screen.getByRole('button', { name: 'Ajustar à tela' });
    fireEvent.click(fit);

    expect(within(diagram()).getByText('Analisar')).toBeTruthy();
  });

  it('mostra as raias do processo principal', async () => {
    render(viewer({ documentText: drawingText({ lanes }) }));
    await findBlock('Etapa: Analisar');

    expect(within(diagram()).getByText('Financeiro')).toBeTruthy();
  });

  it('abre o subprocesso e mostra os estados das etapas de dentro dele', async () => {
    render(
      viewer({
        documentText: drawingText({ lanes }),
        states: { billing: 'active', 'billing/charge': 'active' },
        taken: [exitKey({ stepRef: 'billing/charge', exitId: 'out' })],
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir Cobrança' }),
    );

    expect(await findBlock('Etapa: Cobrar, etapa atual')).toBeTruthy();
    expect(
      await screen.findByRole('group', {
        name: 'Conexão de Cobrar para Pago, caminho percorrido',
      }),
    ).toBeTruthy();
    const levels = screen.getByRole('navigation', {
      name: 'Níveis do processo',
    });
    expect(
      within(levels).getByText('Cobrança').getAttribute('aria-current'),
    ).toBe('page');
    expect(within(diagram()).queryByText('Analisar')).toBeNull();
    expect(within(diagram()).queryByText('Financeiro')).toBeNull();
  });

  it('volta ao processo principal pela trilha', async () => {
    render(viewer({ states: { review: 'active' } }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir Cobrança' }),
    );
    await findBlock('Etapa: Cobrar');

    fireEvent.click(screen.getByRole('button', { name: 'Processo principal' }));

    expect(await findBlock('Etapa: Analisar, etapa atual')).toBeTruthy();
    expect(
      screen.queryByRole('navigation', { name: 'Níveis do processo' }),
    ).toBeNull();
  });

  it('avisa quando o subprocesso aberto não tem blocos desenhados', async () => {
    const empty = block({
      id: 'billing',
      type: 'subprocess',
      data: { label: 'Cobrança' },
    });
    render(
      viewer({
        documentText: drawingText({
          nodes: [
            block({ id: 'start', type: 'start' }),
            block({ id: 'review', type: 'task' }),
            empty,
            block({ id: 'end', type: 'end' }),
          ],
        }),
      }),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir Cobrança' }),
    );

    expect(
      await screen.findByText(
        'Este nível do processo não tem blocos desenhados.',
      ),
    ).toBeTruthy();
  });

  it('volta ao nível que ainda existe quando o desenho muda com um subprocesso aberto', async () => {
    const { rerender } = render(viewer());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir Cobrança' }),
    );
    await findBlock('Etapa: Cobrar');

    rerender(
      viewer({
        documentText: drawingText({
          nodes: [
            block({ id: 'start', type: 'start' }),
            block({ id: 'review', type: 'task', data: { label: 'Revisar' } }),
            block({ id: 'billing', type: 'task', data: { label: 'Faturar' } }),
            block({ id: 'end', type: 'end' }),
          ],
        }),
      }),
    );

    expect(await findBlock('Etapa: Revisar')).toBeTruthy();
    expect(
      screen.queryByRole('navigation', { name: 'Níveis do processo' }),
    ).toBeNull();
  });

  it('mostra o estado de erro, sem quebrar, quando o desenho está ilegível', () => {
    render(viewer({ documentText: '{quebrado' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'Não foi possível ler o desenho deste processo.',
    );
    expect(screen.queryByLabelText('Diagrama da execução')).toBeNull();
  });
});
