import { fireEvent, render, screen } from '@testing-library/react';

import { BoardSaveNotice } from './board-save-notice';
import type { SaveActions } from './use-board-storage';

function actions(): SaveActions {
  return { retry: vi.fn(), keepMine: vi.fn(), takeTheirs: vi.fn() };
}

describe('BoardSaveNotice', () => {
  it('não mostra nada com tudo gravado ou com a gravação em andamento', () => {
    const { container, rerender } = render(
      <BoardSaveNotice save={{ kind: 'saved' }} actions={actions()} />,
    );
    rerender(
      <BoardSaveNotice save={{ kind: 'pending' }} actions={actions()} />,
    );

    expect(container.textContent).toBe('');
  });

  it('no navegador, mostra o motivo da falha sem saída nenhuma', () => {
    render(
      <BoardSaveNotice
        save={{ kind: 'failed', message: 'Sem espaço.', busy: false }}
      />,
    );

    expect(screen.getByRole('alert').textContent).toBe('Sem espaço.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no servidor, mostra a falha com a nova tentativa', () => {
    const exits = actions();
    render(
      <BoardSaveNotice
        save={{ kind: 'failed', message: 'Sem rede.', busy: false }}
        actions={exits}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'só valem enquanto esta página estiver aberta. Sem rede.',
    );
    expect(exits.retry).toHaveBeenCalledTimes(1);
  });

  it('trava a nova tentativa enquanto ela corre', () => {
    render(
      <BoardSaveNotice
        save={{ kind: 'failed', message: 'Sem rede.', busy: true }}
        actions={actions()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    ).toHaveProperty('disabled', true);
  });

  it('no conflito, oferece recarregar do servidor e manter a versão da tela', () => {
    const exits = actions();
    render(
      <BoardSaveNotice
        save={{ kind: 'conflict', busy: false }}
        actions={exits}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Recarregar do servidor' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Manter a minha versão' }),
    );

    expect(exits.takeTheirs).toHaveBeenCalledTimes(1);
    expect(exits.keepMine).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Não deu certo/)).toBeNull();
  });

  it('no conflito, conta por que a saída não deu certo e trava as duas enquanto uma corre', () => {
    render(
      <BoardSaveNotice
        save={{ kind: 'conflict', busy: true, failure: 'Sem rede.' }}
        actions={actions()}
      />,
    );

    expect(screen.getByText('Não deu certo: Sem rede.')).toBeTruthy();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });

  it('sem as saídas do servidor, o conflito não tem o que mostrar', () => {
    const { container } = render(
      <BoardSaveNotice save={{ kind: 'conflict', busy: false }} />,
    );

    expect(container.textContent).toBe('');
  });
});
