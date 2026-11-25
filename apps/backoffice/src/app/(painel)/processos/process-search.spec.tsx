import { fireEvent, render, screen } from '@testing-library/react';

import { block } from './model/test-graph';
import { toProcessGraph } from './process-graph';
import { ProcessSearch } from './process-search';

const graph = toProcessGraph({
  nodes: [
    block({
      id: 'review',
      type: 'human-task',
      data: { label: 'Analisar', role: 'Jurídico' },
    }),
  ],
  edges: [],
});

describe('ProcessSearch', () => {
  it('mostra os resultados e leva ao bloco escolhido', () => {
    const onSelect = vi.fn();
    render(<ProcessSearch graph={graph} onSelect={onSelect} />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar no processo' }),
      {
        target: { value: 'jurid' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /Analisar/ }));

    expect(onSelect).toHaveBeenCalledWith('review');
  });

  it('avisa quando nada é encontrado', () => {
    render(<ProcessSearch graph={graph} onSelect={vi.fn()} />);

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'xyz' },
    });

    expect(screen.getByText('Nada encontrado.')).toBeTruthy();
  });
});
