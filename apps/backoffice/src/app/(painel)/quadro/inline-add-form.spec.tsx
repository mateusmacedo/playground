import { fireEvent, render, screen } from '@testing-library/react';

import { InlineAddForm } from './inline-add-form';

function renderForm(keepOpen = false) {
  const onAdd = vi.fn();
  render(
    <InlineAddForm
      buttonLabel="Adicionar item"
      inputLabel="Nome do item"
      keepOpen={keepOpen}
      onAdd={onAdd}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
  return {
    onAdd,
    input: screen.getByRole('textbox', { name: 'Nome do item' }),
  };
}

describe('InlineAddForm', () => {
  it('abre o campo com o foco e não inclui texto vazio', () => {
    const { onAdd, input } = renderForm();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input);

    expect(onAdd).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('inclui, fecha e devolve o foco ao botão', () => {
    const { onAdd, input } = renderForm();
    fireEvent.change(input, { target: { value: 'Novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onAdd).toHaveBeenCalledWith('Novo');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Adicionar item' }),
    );
  });

  it('com keepOpen, limpa o campo e espera o próximo', () => {
    const { onAdd, input } = renderForm(true);
    fireEvent.change(input, { target: { value: 'Primeiro' } });
    fireEvent.submit(input);

    expect(onAdd).toHaveBeenCalledWith('Primeiro');
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('fecha pelo Esc e pelo Cancelar sem incluir', () => {
    const { onAdd, input } = renderForm();
    fireEvent.change(input, { target: { value: 'Descartado' } });
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }));
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Nome do item',
        }) as HTMLInputElement
      ).value,
    ).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
