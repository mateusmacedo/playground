import { render, screen } from '@testing-library/react';

import HomePage, { metadata } from './page';

describe('HomePage', () => {
  it('mostra o título da página inicial', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Início' })).toBeTruthy();
  });

  it('indica onde entram as páginas novas', () => {
    render(<HomePage />);

    expect(screen.getByText('src/app/(painel)')).toBeTruthy();
    expect(screen.getByText('src/layout/nav.ts')).toBeTruthy();
    expect(screen.getByText('src/layout/routes.ts')).toBeTruthy();
  });

  it('define o título da aba', () => {
    expect(metadata.title).toBe('Início');
  });
});
