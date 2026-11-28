import { addCard } from './cards';
import { inheritedFromParent } from './child-inherit';
import { processBoard } from './process-test-data';

const parent = {
  id: 'p',
  title: 'Pai',
  assigneeId: 'ana',
  labelIds: ['urgente'],
};

describe('inheritedFromParent', () => {
  it('passa o responsável e as etiquetas do pai com a regra ligada', () => {
    const board = processBoard({
      todo: [parent],
      rules: { childInherits: true },
    });
    expect(inheritedFromParent({ board, parentId: 'p' })).toEqual({
      assigneeId: 'ana',
      labelIds: ['urgente'],
    });
  });

  it('não passa nada com a regra desligada, sem pai ou com pai fora das colunas', () => {
    const off = processBoard({ todo: [parent] });
    expect(inheritedFromParent({ board: off, parentId: 'p' })).toEqual({});
    const on = processBoard({ todo: [parent], rules: { childInherits: true } });
    expect(inheritedFromParent({ board: on, parentId: undefined })).toEqual({});
    expect(inheritedFromParent({ board: on, parentId: 'sumiu' })).toEqual({});
  });

  it('não inventa o que o pai não tem', () => {
    const board = processBoard({
      todo: [{ id: 'p', title: 'Pai', labelIds: [] }],
      rules: { childInherits: true },
    });
    expect(inheritedFromParent({ board, parentId: 'p' })).toEqual({});
  });
});

describe('addCard com dados herdados', () => {
  it('cria o card com o responsável e as etiquetas que vieram', () => {
    const board = processBoard();
    const lanes = addCard({
      lanes: board.lanes,
      laneId: 'todo',
      card: {
        id: 'f',
        title: 'Filho',
        parentId: 'p',
        assigneeId: 'ana',
        labelIds: ['urgente'],
      },
    });
    expect(lanes[0]?.cards[0]).toEqual({
      id: 'f',
      title: 'Filho',
      parentId: 'p',
      number: undefined,
      assigneeId: 'ana',
      labelIds: ['urgente'],
    });
  });
});
