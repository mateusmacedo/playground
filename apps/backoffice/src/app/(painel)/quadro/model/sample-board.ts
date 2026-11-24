import type { BoardLane } from './board';

/** Dados de exemplo enquanto o quadro não tem origem real: só o formato agnóstico de colunas e cards. */
export const sampleLanes: readonly BoardLane[] = [
  {
    id: 'todo',
    title: 'A fazer',
    cards: [
      {
        id: 'item-1',
        title: 'Item 1',
        description: 'Card de exemplo, sem tipo definido.',
      },
      { id: 'item-2', title: 'Item 2', parentId: 'item-1' },
      { id: 'item-3', title: 'Item 3', parentId: 'item-1' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'item-4', title: 'Item 4' }],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];
