import { fireEvent, render, screen } from '@testing-library/react';

import { ErrorScreen, getErrorDigest } from './error-screen';

const serverError = Object.assign(new Error('senha do banco: hunter2'), {
  digest: 'abc123',
});

describe('getErrorDigest', () => {
  it('devolve o digest quando existe', () => {
    expect(getErrorDigest(serverError)).toBe('abc123');
  });

  it.each([
    ['um Error sem digest', new Error('falhou')],
    ['um digest vazio', { digest: '' }],
    ['um digest que não é texto', { digest: 42 }],
    ['um texto lançado', 'falhou'],
    ['null', null],
    ['undefined', undefined],
  ])('devolve undefined para %s', (_caso, error) => {
    expect(getErrorDigest(error)).toBeUndefined();
  });
});

describe('ErrorScreen', () => {
  it('mostra o digest e nunca a mensagem do erro', () => {
    render(<ErrorScreen error={serverError} retry={() => undefined} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Código do erro: abc123');
    expect(document.body.textContent).not.toContain('hunter2');
  });

  it('não mostra código quando o erro não tem digest', () => {
    render(<ErrorScreen error={new Error('falhou')} retry={() => undefined} />);

    expect(screen.getByRole('alert').textContent).not.toContain(
      'Código do erro',
    );
  });

  it('tenta de novo sem repassar o evento do clique', () => {
    const retry = vi.fn();
    render(<ErrorScreen error={serverError} retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith();
  });
});
