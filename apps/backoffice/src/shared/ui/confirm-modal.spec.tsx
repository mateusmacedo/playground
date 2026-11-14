import { act, fireEvent, render, screen } from '@testing-library/react';

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
