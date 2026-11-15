import { render, screen } from '@testing-library/react';

import NotFound from './not-found';

describe('NotFound', () => {
  it('avisa que a página não existe', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Página não encontrada' }),
    ).toBeTruthy();
  });

  it('oferece a volta ao início', () => {
    render(<NotFound />);

    const link = screen.getByRole('link', { name: 'Voltar ao início' });

    expect(link.getAttribute('href')).toBe('/');
  });
});
