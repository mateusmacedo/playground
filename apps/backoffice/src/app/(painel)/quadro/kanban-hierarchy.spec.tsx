import { cleanup, fireEvent, screen, within } from '@testing-library/react';

import type { Board } from './model/board';
import { processBoard } from './model/process-test-data';
import {
  cardItem,
  detailsPanel,
  openCard,
  renderStoredBoard,
  showView,
  TEST_BOARD_KEY,
  tableCardTitles,
} from './stored-board-test-kit';
import { boardViewKey } from './use-board-view';

// Projeto > Fase > (Tarefa, Ajuste) e Projeto > Entrega, que já está concluída; Avulso não tem pai nem filho.
function board(): Board {
  return processBoard({
    todo: [
      { id: 'projeto', title: 'Projeto' },
      { id: 'fase', title: 'Fase', parentId: 'projeto' },
      { id: 'tarefa', title: 'Tarefa', parentId: 'fase' },
      { id: 'avulso', title: 'Avulso' },
    ],
    doing: [{ id: 'ajuste', title: 'Ajuste', parentId: 'fase' }],
    done: [{ id: 'entrega', title: 'Entrega', parentId: 'projeto' }],
  });
}

function hierarchy(): HTMLSelectElement {
  return screen.getByRole('combobox', {
    name: 'Filtrar por hierarquia',
  }) as HTMLSelectElement;
}

function chooseHierarchy(value: string) {
  fireEvent.change(hierarchy(), { target: { value } });
}

function isOutsideFilter(title: string): boolean {
  return within(cardItem(title)).queryByText('Fora da busca.') !== null;
}

function treeSwitch(): HTMLInputElement {
  return screen.getByRole('checkbox', {
    name: 'Lista em árvore',
  }) as HTMLInputElement;
}

function childrenToggle(title: string): HTMLElement {
  return screen.getByRole('button', { name: `Filhos de ${title}` });
}

function storedView(): unknown {
  const raw = localStorage.getItem(boardViewKey(TEST_BOARD_KEY));
  return raw ? JSON.parse(raw) : null;
}

describe('KanbanBoard: progresso de todas as descendentes', () => {
  afterEach(() => localStorage.clear());

  it('conta no pai os filhos, os netos e assim por diante, no card e no painel', async () => {
    await renderStoredBoard(board());

    expect(
      within(cardItem('Projeto')).getByText('1 de 4 descendentes concluídos'),
    ).toBeTruthy();
    expect(
      within(cardItem('Projeto')).getByText('1/4 descendentes'),
    ).toBeTruthy();
    expect(
      within(cardItem('Fase')).getByText('0 de 2 filhos concluídos'),
    ).toBeTruthy();

    openCard('Projeto');
    expect(
      within(detailsPanel()).getByText('(1 de 4 descendentes concluídos)'),
    ).toBeTruthy();
  });

  it('mostra o progresso agregado na coluna "Filhos" da lista', async () => {
    await renderStoredBoard(board());

    showView('Lista');

    const row = within(screen.getByRole('table')).getByRole('row', {
      name: /Projeto/,
    });
    expect(
      within(row).getByText('1 de 4 descendentes concluídos'),
    ).toBeTruthy();
  });
});

describe('KanbanBoard: filtro de hierarquia', () => {
  afterEach(() => localStorage.clear());

  it('destaca só os cards pai, só os filhos ou só os de topo, e conta no indicador de filtro', async () => {
    await renderStoredBoard(board());
    expect(hierarchy().value).toBe('all');
    expect(screen.queryByText(/de 6 cards/)).toBeNull();

    chooseHierarchy('parents');
    expect(screen.getByText('2 de 6 cards')).toBeTruthy();
    expect(isOutsideFilter('Projeto')).toBe(false);
    expect(isOutsideFilter('Fase')).toBe(false);
    expect(isOutsideFilter('Avulso')).toBe(true);

    chooseHierarchy('children');
    expect(screen.getByText('4 de 6 cards')).toBeTruthy();
    expect(isOutsideFilter('Projeto')).toBe(true);
    expect(isOutsideFilter('Entrega')).toBe(false);

    chooseHierarchy('top');
    expect(screen.getByText('2 de 6 cards')).toBeTruthy();
    expect(isOutsideFilter('Avulso')).toBe(false);
    expect(isOutsideFilter('Fase')).toBe(true);

    chooseHierarchy('all');
    expect(screen.queryByText(/de 6 cards/)).toBeNull();
    expect(isOutsideFilter('Fase')).toBe(false);
  });

  it('soma-se à busca', async () => {
    await renderStoredBoard(board());

    chooseHierarchy('top');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'avulso' },
    });

    expect(screen.getByText('1 de 6 cards')).toBeTruthy();
    expect(isOutsideFilter('Projeto')).toBe(true);
    expect(isOutsideFilter('Avulso')).toBe(false);
  });

  it('deixa na lista só as linhas que passam no filtro', async () => {
    await renderStoredBoard(board());
    showView('Lista');

    chooseHierarchy('parents');

    expect(tableCardTitles()).toEqual(['Projeto', 'Fase']);
  });
});

describe('KanbanBoard: lista em árvore', () => {
  afterEach(() => localStorage.clear());

  it('põe cada card abaixo do pai, com o nível, e só liga a árvore na lista', async () => {
    await renderStoredBoard(board());
    expect(treeSwitch().disabled).toBe(true);

    showView('Lista');
    expect(tableCardTitles()).toEqual([
      'Projeto',
      'Fase',
      'Tarefa',
      'Avulso',
      'Ajuste',
      'Entrega',
    ]);
    fireEvent.click(treeSwitch());

    expect(tableCardTitles()).toEqual([
      'Projeto',
      'Fase',
      'Tarefa',
      'Ajuste',
      'Entrega',
      'Avulso',
    ]);
    const table = within(screen.getByRole('table'));
    const nested = table.getByRole('row', { name: /Tarefa/ });
    expect(within(nested).getByText('Nível 3:')).toBeTruthy();
    expect(childrenToggle('Projeto').getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(
      screen.queryByRole('button', { name: 'Filhos de Avulso' }),
    ).toBeNull();
  });

  it('recolhe e expande os filhos de uma linha, expondo o estado', async () => {
    await renderStoredBoard(board());
    showView('Lista');
    fireEvent.click(treeSwitch());

    fireEvent.click(childrenToggle('Fase'));
    expect(childrenToggle('Fase').getAttribute('aria-expanded')).toBe('false');
    expect(tableCardTitles()).toEqual(['Projeto', 'Fase', 'Entrega', 'Avulso']);

    fireEvent.click(childrenToggle('Projeto'));
    expect(tableCardTitles()).toEqual(['Projeto', 'Avulso']);

    fireEvent.click(childrenToggle('Projeto'));
    expect(childrenToggle('Projeto').getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(tableCardTitles()).toEqual(['Projeto', 'Fase', 'Entrega', 'Avulso']);
  });

  it('mantém a ordenação escolhida dentro de cada nível', async () => {
    await renderStoredBoard(board());
    showView('Lista');
    fireEvent.click(treeSwitch());

    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    expect(tableCardTitles()).toEqual([
      'Avulso',
      'Projeto',
      'Entrega',
      'Fase',
      'Ajuste',
      'Tarefa',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Título' }));
    expect(tableCardTitles()).toEqual([
      'Projeto',
      'Fase',
      'Tarefa',
      'Ajuste',
      'Entrega',
      'Avulso',
    ]);
  });

  it('põe no topo o card cujo pai o filtro tirou da lista', async () => {
    await renderStoredBoard(board());
    showView('Lista');
    fireEvent.click(treeSwitch());

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'tarefa' },
    });

    expect(tableCardTitles()).toEqual(['Tarefa']);
    const row = within(screen.getByRole('table')).getByRole('row', {
      name: /Tarefa/,
    });
    expect(within(row).queryByText(/Nível/)).toBeNull();
  });

  it('grava a árvore e as linhas recolhidas como preferência e as retoma ao reabrir', async () => {
    await renderStoredBoard(board());
    showView('Lista');
    fireEvent.click(treeSwitch());
    fireEvent.click(childrenToggle('Projeto'));
    expect(storedView()).toMatchObject({
      mode: 'list',
      tree: true,
      collapsedRows: ['projeto'],
    });

    cleanup();
    await renderStoredBoard(board());

    expect(treeSwitch().checked).toBe(true);
    expect(tableCardTitles()).toEqual(['Projeto', 'Avulso']);
    expect(childrenToggle('Projeto').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('abre o quadro em colunas quando a preferência gravada não é um JSON', async () => {
    localStorage.setItem(boardViewKey(TEST_BOARD_KEY), '{quebrado');
    await renderStoredBoard(board());

    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
    expect(treeSwitch().checked).toBe(false);
  });

  it('abre a lista plana quando a preferência gravada não dá para ler', async () => {
    localStorage.setItem(
      boardViewKey(TEST_BOARD_KEY),
      JSON.stringify({ mode: 'outra', tree: 'sim', collapsedRows: 'projeto' }),
    );
    await renderStoredBoard(board());

    expect(screen.getByRole('region', { name: 'A fazer' })).toBeTruthy();
    showView('Lista');
    expect(treeSwitch().checked).toBe(false);
    expect(screen.queryByRole('button', { name: /^Filhos de / })).toBeNull();
  });
});
