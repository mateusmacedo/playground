import { fireEvent, render, screen } from '@testing-library/react';

import { ToastProvider, useToast } from './toast';

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

describe('useToast', () => {
  it('falha fora do ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Triggers />)).toThrow(
      'useToast precisa estar dentro do ToastProvider.',
    );

    vi.restoreAllMocks();
  });
});
