import { fireEvent, screen, within } from '@testing-library/react';

import type { Board } from './model/board';
import { processBoard } from './model/process-test-data';
import {
  announcement,
  cardItem,
  detailsPanel,
  openCard,
  renderStoredBoard,
  showView,
} from './stored-board-test-kit';

// Beta é bloqueado por Alfa; Gama e Delta estão soltos; Fim já está na coluna de conclusão.
function board(): Board {
  return processBoard({
    todo: [
      { id: 'alfa', title: 'Alfa' },
      { id: 'beta', title: 'Beta', blockedBy: ['alfa'] },
    ],
    doing: [
      { id: 'gama', title: 'Gama' },
      { id: 'delta', title: 'Delta' },
    ],
    done: [{ id: 'fim', title: 'Fim' }],
  });
}

function dependencies(): HTMLElement {
  return within(detailsPanel()).getByRole('region', { name: 'Dependências' });
}

function listItems(name: string): string[] {
  const list = within(dependencies()).getByRole('list', { name });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

function newBlocker(): HTMLSelectElement {
  return within(dependencies()).getByLabelText(
    'Novo bloqueador',
  ) as HTMLSelectElement;
}

function addBlocker(cardId: string) {
  fireEvent.change(newBlocker(), { target: { value: cardId } });
  fireEvent.click(
    within(dependencies()).getByRole('button', {
      name: 'Adicionar bloqueador',
    }),
  );
}

function moveOpenCardTo(laneId: string) {
  fireEvent.change(within(detailsPanel()).getByLabelText('Coluna'), {
    target: { value: laneId },
  });
}

describe('KanbanBoard: dependências entre cards', () => {
  afterEach(() => localStorage.clear());

  it('marca com o selo "Bloqueado" o card com bloqueador pendente, no quadro e na lista', async () => {
    await renderStoredBoard(board());

    expect(within(cardItem('Beta')).getByText('Bloqueado')).toBeTruthy();
    expect(within(cardItem('Alfa')).queryByText('Bloqueado')).toBeNull();

    showView('Lista');
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const blocked = rows.filter((row) => within(row).queryByText('Bloqueado'));
    expect(blocked).toHaveLength(1);
    expect(
      within(blocked[0]).getByRole('button', { name: 'Beta' }),
    ).toBeTruthy();
  });

  it('adiciona um bloqueador pelo painel, anuncia, marca o card e registra no histórico', async () => {
    await renderStoredBoard(board());
    openCard('Gama');
    expect(within(dependencies()).getByText('Nenhum bloqueador.')).toBeTruthy();

    addBlocker('alfa');

    expect(listItems('Bloqueado por')).toEqual(['Alfa (A fazer) Pendente']);
    expect(announcement()).toBe('Card Alfa passou a bloquear Gama.');
    expect(within(cardItem('Gama')).getByText('Bloqueado')).toBeTruthy();
    expect(
      within(detailsPanel()).getByText('Passou a ser bloqueado por Alfa.'),
    ).toBeTruthy();
    expect(newBlocker().value).toBe('');
  });

  it('mostra em "Bloqueia" os cards que dependem do card e abre cada um pelo link', async () => {
    await renderStoredBoard(board());
    openCard('Alfa');

    expect(listItems('Bloqueia')).toEqual(['Beta (A fazer)']);
    fireEvent.click(
      within(dependencies()).getByRole('button', { name: 'Beta' }),
    );

    expect(
      (within(detailsPanel()).getByLabelText('Título') as HTMLInputElement)
        .value,
    ).toBe('Beta');
    expect(listItems('Bloqueado por')).toEqual(['Alfa (A fazer) Pendente']);
  });

  it('não oferece como bloqueador o próprio card nem o que fecharia um ciclo', async () => {
    await renderStoredBoard(board());
    openCard('Alfa');

    const options = Array.from(newBlocker().options, (option) => option.text);
    expect(options).toEqual([
      'Escolha um card',
      'Gama (Em andamento)',
      'Delta (Em andamento)',
      'Fim (Concluído)',
    ]);
  });

  it('tira o selo, no quadro e na lista, quando o bloqueador chega à coluna de conclusão e mostra a situação dele', async () => {
    await renderStoredBoard(board());
    openCard('Alfa');

    moveOpenCardTo('done');

    expect(within(cardItem('Beta')).queryByText('Bloqueado')).toBeNull();
    openCard('Beta');
    expect(listItems('Bloqueado por')).toEqual(['Alfa (Concluído) Concluído']);

    showView('Lista');
    expect(
      within(screen.getByRole('table')).queryByText('Bloqueado'),
    ).toBeNull();
  });

  it('remove o bloqueador pelo painel, anuncia, leva o foco ao campo e registra no histórico', async () => {
    await renderStoredBoard(board());
    openCard('Beta');

    fireEvent.click(
      within(dependencies()).getByRole('button', {
        name: 'Remover o bloqueador Alfa',
      }),
    );

    expect(within(dependencies()).getByText('Nenhum bloqueador.')).toBeTruthy();
    expect(announcement()).toBe('Card Alfa deixou de bloquear Beta.');
    expect(document.activeElement).toBe(newBlocker());
    expect(within(cardItem('Beta')).queryByText('Bloqueado')).toBeNull();
    expect(
      within(detailsPanel()).getByText('Deixou de ser bloqueado por Alfa.'),
    ).toBeTruthy();
  });

  it('leva o foco ao título da lista quando o último card possível vira bloqueador', async () => {
    await renderStoredBoard(
      processBoard({
        todo: [
          { id: 'um', title: 'Um' },
          { id: 'dois', title: 'Dois' },
        ],
      }),
    );
    openCard('Um');

    addBlocker('dois');

    expect(
      within(dependencies()).getByText('Nenhum outro card pode bloquear este.'),
    ).toBeTruthy();
    expect(
      within(dependencies()).queryByLabelText('Novo bloqueador'),
    ).toBeNull();
    expect(document.activeElement).toBe(
      within(dependencies()).getByRole('heading', { name: 'Bloqueado por' }),
    );
  });

  it('desfaz a dependência num passo só', async () => {
    await renderStoredBoard(board());
    openCard('Gama');
    addBlocker('delta');

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(within(cardItem('Gama')).queryByText('Bloqueado')).toBeNull();
    expect(within(dependencies()).getByText('Nenhum bloqueador.')).toBeTruthy();
  });
});
