import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';

import { CanvasActionsProvider } from '../canvas-actions';
import { IssuesProvider } from '../issues-context';
import { mockReactFlow } from '../react-flow-test-setup';
import { BlockNode } from './block-node';

mockReactFlow();

type BlockNodeProps = Parameters<typeof BlockNode>[0];

interface RenderBlockParams {
  readonly type: string;
  readonly data: BlockNodeProps['data'];
}

function renderBlock({ type, data }: RenderBlockParams) {
  const props = { id: 'block', type, data } as unknown as BlockNodeProps;
  render(
    <ReactFlowProvider>
      <CanvasActionsProvider
        value={{
          openSubprocess: vi.fn(),
          requestInsertOnEdge: vi.fn(),
          explainConnection: () => null,
        }}
      >
        <IssuesProvider value={new Map()}>
          <BlockNode {...props} />
        </IssuesProvider>
      </CanvasActionsProvider>
    </ReactFlowProvider>,
  );
}

function renderSubprocess(data: BlockNodeProps['data']) {
  renderBlock({ type: 'subprocess', data });
}

describe('BlockNode do subprocesso', () => {
  it('mostra objetivo, entradas e saídas no bloco', () => {
    renderSubprocess({
      label: 'Cobrança',
      goal: 'Receber o pagamento',
      inputs: 'Pedido aprovado',
      outputs: 'Pagamento confirmado',
    });

    expect(screen.getByText('Receber o pagamento')).toBeTruthy();
    expect(screen.getByText('Entradas').nextElementSibling?.textContent).toBe(
      'Pedido aprovado',
    );
    expect(screen.getByText('Saídas').nextElementSibling?.textContent).toBe(
      'Pagamento confirmado',
    );
  });

  it('não mostra a lista quando entradas e saídas estão vazias', () => {
    renderSubprocess({ label: 'Cobrança', inputs: ' ' });

    expect(screen.queryByText('Entradas')).toBeNull();
  });
});

describe('BlockNode da aprovação', () => {
  it('mostra o aprovador, a entrada e as duas saídas com o nome do parecer', () => {
    renderBlock({
      type: 'approval',
      data: { label: 'Aprovar compra', role: 'Diretoria' },
    });

    expect(screen.getByText('Aprovador: Diretoria')).toBeTruthy();
    expect(screen.getByLabelText('Entrada de Aprovar compra')).toBeTruthy();
    expect(
      screen.getByLabelText('Saída Aprovado de Aprovar compra'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Saída Rejeitado de Aprovar compra'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Saída de Aprovar compra')).toBeNull();
  });
});
