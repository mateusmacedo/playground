import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ConfirmModal } from './confirm-modal';

function renderModal(onConfirm: () => void | Promise<void>) {
  render(
    <ConfirmModal
      onCancel={() => undefined}
      onConfirm={onConfirm}
      title="Excluir cotação"
      visible
    >
      A cotação some da lista.
    </ConfirmModal>,
  );
  return screen.findByRole('button', { name: 'Confirmar' });
}

describe('ConfirmModal', () => {
  it('chama onConfirm uma vez por clique quando a ação é síncrona', async () => {
    const onConfirm = vi.fn();
    const confirm = await renderModal(onConfirm);

    fireEvent.click(confirm);
    await act(async () => undefined);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('ignora o segundo clique enquanto a confirmação anterior não termina', async () => {
    let finish: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const confirm = await renderModal(onConfirm);

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('trava os botões enquanto a tela marca busy', async () => {
    render(
      <ConfirmModal
        busy
        onCancel={() => undefined}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible
      >
        A cotação some da lista.
      </ConfirmModal>,
    );

    const confirm = await screen.findByRole('button', { name: 'Confirmar' });
    const cancel = screen.getByRole('button', { name: 'Cancelar' });

    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(cancel.hasAttribute('disabled')).toBe(true);
  });
});

describe('ConfirmModal, cancelamento e variações', () => {
  it('cancela quando o usuário fecha pelo X do cabeçalho', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        onCancel={onCancel}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible
      >
        A cotação some da lista.
      </ConfirmModal>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancela pelo botão "Cancelar"', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        onCancel={onCancel}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible
      >
        A cotação some da lista.
      </ConfirmModal>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('não conta como cancelamento quando a tela fecha o modal', async () => {
    const onCancel = vi.fn();
    const modal = (visible: boolean) => (
      <ConfirmModal
        onCancel={onCancel}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible={visible}
      >
        A cotação some da lista.
      </ConfirmModal>
    );
    const { rerender } = render(modal(true));
    await screen.findByRole('button', { name: 'Confirmar' });

    rerender(modal(false));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull(),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('esconde o X do cabeçalho enquanto a tela marca busy', async () => {
    render(
      <ConfirmModal
        busy
        onCancel={() => undefined}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible
      >
        A cotação some da lista.
      </ConfirmModal>,
    );

    await screen.findByRole('button', { name: 'Confirmar' });

    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('usa os textos dados nos botões e trava a confirmação com confirmDisabled', async () => {
    render(
      <ConfirmModal
        cancelLabel="Voltar"
        confirmColor="danger"
        confirmDisabled
        confirmLabel="Excluir"
        onCancel={() => undefined}
        onConfirm={() => undefined}
        title="Excluir cotação"
        visible
      >
        A cotação some da lista.
      </ConfirmModal>,
    );

    const confirm = await screen.findByRole('button', { name: 'Excluir' });

    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeTruthy();
  });
});
