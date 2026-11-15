import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { TOAST_DELAY_MS, ToastProvider, useToast } from './toast';

function Triggers() {
  const toast = useToast();
  return (
    <>
      <button
        onClick={() => {
          toast.success('Cotação salva.');
          toast.danger('Falha ao enviar o e-mail.', 'Não enviou');
        }}
        type="button"
      >
        Salvar e enviar
      </button>
      <button onClick={() => toast.info('Sincronizado.')} type="button">
        Sincronizar
      </button>
      <button onClick={() => toast.warning('Cota quase cheia.')} type="button">
        Alertar
      </button>
      <button onClick={() => toast.show('Sem tipo informado.')} type="button">
        Mostrar
      </button>
    </>
  );
}

function renderProvider() {
  render(
    <ToastProvider>
      <Triggers />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  it('mostra os dois avisos disparados no mesmo instante', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar e enviar' }));

    expect(await screen.findByText('Cotação salva.')).toBeTruthy();
    expect(await screen.findByText('Falha ao enviar o e-mail.')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('usa o título do tipo quando não recebe um, e o título dado quando recebe', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar e enviar' }));

    expect(await screen.findByText('Pronto')).toBeTruthy();
    expect(await screen.findByText('Não enviou')).toBeTruthy();
  });

  it('mantém os avisos antigos quando chega um novo', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e enviar' }));

    expect(await screen.findByText('Sincronizado.')).toBeTruthy();
    expect(await screen.findByText('Cotação salva.')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });
});

describe('ToastProvider, tipos e fechamento', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa o título "Atenção" no aviso de warning', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Alertar' }));

    expect(await screen.findByText('Cota quase cheia.')).toBeTruthy();
    expect(screen.getByText('Atenção')).toBeTruthy();
  });

  it('mostra como sucesso o aviso sem tipo', async () => {
    renderProvider();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(await screen.findByText('Sem tipo informado.')).toBeTruthy();
    expect(screen.getByText('Pronto')).toBeTruthy();
  });

  it('tira só o aviso fechado pelo botão, mantendo os outros', async () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e enviar' }));
    expect(await screen.findByText('Cotação salva.')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    await waitFor(() =>
      expect(screen.queryByText('Cotação salva.')).toBeNull(),
    );
    expect(screen.getByText('Falha ao enviar o e-mail.')).toBeTruthy();
  });

  it('fecha o aviso sozinho depois do tempo de exibição', () => {
    vi.useFakeTimers();
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }));
    expect(screen.getByText('Sincronizado.')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(TOAST_DELAY_MS);
    });
    // WHY: a saída é animada; o aviso só sai da lista depois da transição, que começa no render do passo anterior.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Sincronizado.')).toBeNull();
  });
});

describe('useToast', () => {
  it('falha fora do ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Triggers />)).toThrow(
      'useToast precisa estar dentro do ToastProvider.',
    );

    vi.restoreAllMocks();
  });
});
