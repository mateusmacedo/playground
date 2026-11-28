import { fireEvent, screen, within } from '@testing-library/react';

import type { Board } from './model/board';
import { processBoard } from './model/process-test-data';
import {
  announcement,
  cardItem,
  detailsPanel,
  openCard,
  renderStoredBoard,
} from './stored-board-test-kit';

// Projeto > Fase > (Tarefa, Ajuste); Avulso não tem pai nem filho.
function board(): Board {
  return processBoard({
    todo: [
      { id: 'projeto', title: 'Projeto' },
      { id: 'fase', title: 'Fase', parentId: 'projeto' },
      { id: 'tarefa', title: 'Tarefa', parentId: 'fase' },
      { id: 'avulso', title: 'Avulso' },
    ],
    doing: [{ id: 'ajuste', title: 'Ajuste', parentId: 'fase' }],
  });
}

describe('KanbanBoard: item de checklist que vira card filho', () => {
  afterEach(() => localStorage.clear());

  function addChecklistItem(text: string) {
    const panel = within(detailsPanel());
    fireEvent.click(panel.getByRole('button', { name: 'Adicionar item' }));
    const input = panel.getByRole('textbox', {
      name: 'Texto do novo item do checklist',
    });
    fireEvent.change(input, { target: { value: text } });
    fireEvent.submit(input);
  }

  function convert(text: string) {
    fireEvent.click(
      within(detailsPanel()).getByRole('button', {
        name: `Converter o item ${text} em card filho`,
      }),
    );
  }

  it('cria o card filho com o texto do item, tira o item do checklist e anuncia', async () => {
    await renderStoredBoard(board());
    openCard('Avulso');
    addChecklistItem('Detalhar');

    convert('Detalhar');

    const panel = within(detailsPanel());
    expect(panel.queryByLabelText('Detalhar')).toBeNull();
    expect(panel.getByRole('button', { name: 'Detalhar' })).toBeTruthy();
    expect(
      within(cardItem('Detalhar')).getByText('Filho de Avulso'),
    ).toBeTruthy();
    expect(announcement()).toBe('Item Detalhar convertido em card filho.');
    expect(
      panel.getByText('Item "Detalhar" do checklist convertido em card filho.'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      panel.getByRole('heading', { name: 'Checklist' }),
    );
  });

  it('registra no histórico do filho de onde ele veio', async () => {
    await renderStoredBoard(board());
    openCard('Avulso');
    addChecklistItem('Detalhar');
    convert('Detalhar');

    openCard('Detalhar');

    expect(
      within(detailsPanel()).getByText(
        'Criado em A fazer a partir de um item do checklist de Avulso.',
      ),
    ).toBeTruthy();
  });

  it('desfaz a conversão num passo só', async () => {
    await renderStoredBoard(board());
    openCard('Avulso');
    addChecklistItem('Detalhar');
    convert('Detalhar');

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(
      screen.queryByRole('heading', { level: 3, name: 'Detalhar' }),
    ).toBeNull();
    expect(within(detailsPanel()).getByLabelText('Detalhar')).toBeTruthy();
  });

  it('avisa o motivo quando a coluna do card está bloqueada e mantém o item', async () => {
    await renderStoredBoard(board());
    openCard('Avulso');
    addChecklistItem('Detalhar');
    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'A fazer' })).getByRole(
        'button',
        { name: 'Bloquear coluna' },
      ),
    );

    convert('Detalhar');

    expect(
      screen.getByText(
        'A coluna A fazer está bloqueada: libere a coluna para criar o card filho.',
      ),
    ).toBeTruthy();
    expect(within(detailsPanel()).getByLabelText('Detalhar')).toBeTruthy();
  });
});

describe('KanbanBoard: duplicar com filhos', () => {
  afterEach(() => localStorage.clear());

  function titleField(): HTMLInputElement {
    return within(detailsPanel()).getByLabelText('Título') as HTMLInputElement;
  }

  it('copia o card com todos os descendentes, abre a cópia e anuncia', async () => {
    await renderStoredBoard(board());
    openCard('Fase');

    fireEvent.click(
      within(detailsPanel()).getByRole('button', {
        name: 'Duplicar com filhos',
      }),
    );

    expect(titleField().value).toBe('Fase (cópia)');
    expect(announcement()).toBe('Card Fase duplicado com os filhos.');
    expect(
      screen.getAllByRole('heading', { level: 3, name: 'Tarefa' }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('heading', { level: 3, name: 'Ajuste' }),
    ).toHaveLength(2);
    const children = within(detailsPanel()).getByRole('region', {
      name: /Cards filhos/,
    });
    expect(
      within(children).getByRole('button', { name: 'Tarefa' }),
    ).toBeTruthy();
  });

  it('não oferece a ação no card sem filhos', async () => {
    await renderStoredBoard(board());
    openCard('Avulso');

    expect(
      within(detailsPanel()).queryByRole('button', {
        name: 'Duplicar com filhos',
      }),
    ).toBeNull();
    expect(
      within(detailsPanel()).getByRole('button', { name: 'Duplicar card' }),
    ).toBeTruthy();
  });

  it('avisa o motivo e mantém o card aberto quando o quadro recusa a cópia', async () => {
    await renderStoredBoard(board());
    openCard('Fase');
    fireEvent.click(
      screen.getByRole('button', { name: 'Ações da coluna A fazer' }),
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'A fazer' })).getByRole(
        'button',
        { name: 'Bloquear coluna' },
      ),
    );

    fireEvent.click(
      within(detailsPanel()).getByRole('button', {
        name: 'Duplicar com filhos',
      }),
    );

    expect(titleField().value).toBe('Fase');
    expect(
      screen.getAllByRole('heading', { level: 3, name: 'Tarefa' }),
    ).toHaveLength(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
