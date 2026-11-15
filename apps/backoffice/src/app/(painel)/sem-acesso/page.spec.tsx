import { render, screen } from '@testing-library/react';

import NoAccessPage, { metadata } from './page';

describe('NoAccessPage', () => {
  it('explica que o usuário ainda não tem acesso e a quem pedir', () => {
    render(<NoAccessPage />);

    expect(
      screen.getByRole('heading', { name: 'Seu usuário ainda não tem acesso' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Peça o acesso a quem administra os usuários\./),
    ).toBeTruthy();
  });

  it('define o título da aba', () => {
    expect(metadata.title).toBe('Sem acesso');
  });
});
