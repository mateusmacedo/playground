import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';

import { CanvasActionsProvider } from '../canvas-actions';
import { IssuesProvider } from '../issues-context';
import { mockReactFlow } from '../react-flow-test-setup';
import { BlockNode } from './block-node';

mockReactFlow();

type BlockNodeProps = Parameters<typeof BlockNode>[0];

function renderSubprocess(data: BlockNodeProps['data']) {
  const props = {
    id: 'sub',
    type: 'subprocess',
    data,
  } as unknown as BlockNodeProps;
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
