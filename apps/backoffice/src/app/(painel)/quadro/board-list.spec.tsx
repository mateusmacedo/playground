import { render, screen, within } from '@testing-library/react';

import { BoardList } from './board-list';
import type { BoardLabel, BoardLane } from './model/board';
import { listRows } from './model/views';

const labels: readonly BoardLabel[] = [
  { id: 'urgente', name: 'Urgente', color: 'danger' },
  { id: 'cliente', name: 'Cliente', color: 'info' },
];

const lanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      { id: 'a', title: 'Card A', labelIds: ['cliente', 'urgente'] },
      { id: 'b', title: 'Card B' },
    ],
  },
];

function setup() {
  render(
    <BoardList
      rows={listRows({ lanes, people: new Map() })}
      keyPrefix="QD"
      labels={labels}
      today={undefined}
      progress={new Map()}
      blocked={new Set(['b'])}
      sort={{ key: 'key', direction: 'ascending' }}
      onSort={vi.fn()}
      onOpen={vi.fn()}
    />,
  );
}

function row(card: string): HTMLElement {
  return within(screen.getByRole('table')).getByRole('row', {
    name: new RegExp(card),
  });
}

/** Texto da célula da linha que fica sob o cabeçalho de coluna dado. */
function cellUnder(card: string, header: string): string | null {
  const headers = within(screen.getByRole('table')).getAllByRole(
    'columnheader',
  );
  const index = headers.findIndex((item) => item.textContent === header);
  return within(row(card)).getAllByRole('cell')[index].textContent;
}

describe('BoardList', () => {
  it('mostra as etiquetas do card na coluna "Etiquetas", na ordem do catálogo', () => {
    setup();

    expect(cellUnder('Card A', 'Etiquetas')).toBe('UrgenteCliente');
    expect(cellUnder('Card B', 'Etiquetas')).toBe('');
  });

  it('marca com o selo "Bloqueado" só o card bloqueado', () => {
    setup();

    expect(within(row('Card B')).getByText('Bloqueado')).toBeTruthy();
    expect(within(row('Card A')).queryByText('Bloqueado')).toBeNull();
  });

  it('põe um traço onde o card não tem filhos nem processo', () => {
    setup();

    expect(cellUnder('Card A', 'Filhos')).toBe('—');
    expect(cellUnder('Card A', 'Processo')).toBe('—');
  });
});
