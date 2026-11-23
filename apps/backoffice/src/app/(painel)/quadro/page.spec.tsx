import { render, screen } from '@testing-library/react';

import BoardPage, { metadata } from './page';

describe('BoardPage', () => {
  it('mostra o título e o quadro com as colunas de exemplo', () => {
    render(<BoardPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadro' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
  });

  it('define o título da aba', () => {
    expect(metadata.title).toBe('Quadro');
  });
});
