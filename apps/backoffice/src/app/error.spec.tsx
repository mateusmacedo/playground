import { fireEvent, render, screen } from '@testing-library/react';

import ErrorPage from './error';

describe('ErrorPage', () => {
  it('mostra a tela de erro com o digest e sem a mensagem do erro', () => {
    const error = Object.assign(new Error('senha do banco: hunter2'), {
      digest: 'abc123',
    });

    render(<ErrorPage error={error} retry={() => undefined} />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Código do erro: abc123',
    );
    expect(document.body.textContent).not.toContain('hunter2');
  });

  it('tenta de novo ao clicar no botão', () => {
    const retry = vi.fn();
    render(<ErrorPage error={new Error('falhou')} retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
