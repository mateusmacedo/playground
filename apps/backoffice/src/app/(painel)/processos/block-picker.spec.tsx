import { fireEvent, render, screen, within } from '@testing-library/react';

import { BlockPicker, compatibleSpecs } from './block-picker';

describe('compatibleSpecs', () => {
  it('no meio da conexão, só blocos com entrada e saída', () => {
    const kinds = compatibleSpecs({ purpose: 'edge', edgeId: 'e' }).map(
      (spec) => spec.kind,
    );

    expect(kinds).toContain('human-task');
    expect(kinds).not.toContain('end');
    expect(kinds).not.toContain('start');
    expect(kinds).not.toContain('exception');
  });

  it('a partir de uma saída, qualquer bloco com entrada, inclusive o Fim', () => {
    const kinds = compatibleSpecs({
      purpose: 'output',
      source: 's',
      sourceHandle: 'out',
      position: { x: 0, y: 0 },
    }).map((spec) => spec.kind);

    expect(kinds).toContain('end');
    expect(kinds).not.toContain('annotation');
  });
});

describe('BlockPicker', () => {
  it('lista os tipos por grupo e devolve o escolhido', async () => {
    const onPick = vi.fn();
    render(
      <BlockPicker
        request={{ purpose: 'edge', edgeId: 'e' }}
        onPick={onPick}
        onCancel={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Inserir bloco na conexão',
    });

    fireEvent.click(
      within(dialog).getByRole('button', { name: /Temporizador/ }),
    );

    expect(onPick).toHaveBeenCalledWith('timer');
    expect(
      within(dialog).getByRole('region', { name: 'Desvios' }),
    ).toBeTruthy();
  });

  it('não abre sem pedido', () => {
    render(<BlockPicker request={null} onPick={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
