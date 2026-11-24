import type { BoardLabel, BoardLane } from './board';

/** Etiquetas de exemplo, sem significado próprio; servem para mostrar a cor e o filtro. */
export const sampleLabels: readonly BoardLabel[] = [
  { id: 'label-1', name: 'Urgente', color: 'danger' },
  { id: 'label-2', name: 'Ideia', color: 'info' },
  { id: 'label-3', name: 'Revisar', color: 'warning' },
];

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
        labelIds: ['label-2'],
        checklist: [
          { id: 'item-1', text: 'Primeiro passo', done: true },
          { id: 'item-2', text: 'Segundo passo', done: false },
        ],
      },
      { id: 'item-2', title: 'Item 2', parentId: 'item-1' },
      { id: 'item-3', title: 'Item 3', parentId: 'item-1' },
    ],
  },
  {
    id: 'doing',
    title: 'Em andamento',
    cards: [{ id: 'item-4', title: 'Item 4', labelIds: ['label-1'] }],
  },
  { id: 'done', title: 'Concluído', cards: [] },
];
