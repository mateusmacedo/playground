import { render, screen } from '@testing-library/react';

import BoardPage, { metadata } from './page';

describe('BoardPage', () => {
  it('mostra o título e o quadro com as colunas de exemplo', () => {
    render(<BoardPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadro' }),
    ).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(
      screen.getByText(
        'Em teste: pode mudar, e os dados ficam só neste navegador.',
      ),
    ).toBeTruthy();
    // NOTE: as 3 colunas de exemplo e a coluna automática dos arquivados.
    expect(screen.getAllByRole('region')).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
  });

  it('define o título da aba', () => {
    expect(metadata.title).toBe('Quadro');
  });
});
