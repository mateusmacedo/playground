import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { SwitchConfirmDialog } from './switch-confirm-dialog';

function renderDialog() {
  let finish: () => void = () => undefined;
  const handlers = {
    onSaveAndSwitch: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
    onSwitch: vi.fn(),
    onCancel: vi.fn(),
  };
  render(<SwitchConfirmDialog processName="Compras" {...handlers} />);
  return { handlers, finish: () => finish() };
}

async function dialog() {
  return screen.findByRole('dialog', { name: 'Alterações não salvas' });
}

describe('SwitchConfirmDialog', () => {
  it('nomeia o processo com a alteração não salva', async () => {
    renderDialog();

    expect((await dialog()).textContent).toMatch(/O rascunho de Compras/);
  });

  it('salva uma vez só e trava a janela enquanto grava', async () => {
    const { handlers, finish } = renderDialog();
    const modal = await dialog();
    const save = within(modal).getByRole('button', { name: 'Salvar e trocar' });

    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(handlers.onSaveAndSwitch).toHaveBeenCalledTimes(1);
    const cancel = screen.getByText('Cancelar').closest('button');
    expect(cancel?.disabled).toBe(true);
    expect(handlers.onCancel).not.toHaveBeenCalled();
    await act(async () => finish());
  });

  it('troca sem salvar ou cancela', async () => {
    const { handlers } = renderDialog();
    const modal = await dialog();

    fireEvent.click(
      within(modal).getByRole('button', { name: 'Trocar sem salvar' }),
    );
    fireEvent.keyDown(modal, { key: 'Escape' });

    expect(handlers.onSwitch).toHaveBeenCalledTimes(1);
    expect(handlers.onCancel).toHaveBeenCalled();
  });
});
