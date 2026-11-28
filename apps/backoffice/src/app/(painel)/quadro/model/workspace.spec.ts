import { BOARD_STORAGE_KEY } from './storage';
import {
  addBoard,
  boardStorageKey,
  DEFAULT_BOARD_ID,
  neighborBoard,
  parseStoredBoards,
  removeBoard,
  renameBoard,
  serializeBoards,
  validBoardName,
  type WorkspaceBoard,
} from './workspace';

const boards: readonly WorkspaceBoard[] = [
  { id: 'board-1', name: 'Principal' },
  { id: 'board-2', name: 'Operações' },
  { id: 'board-3', name: 'Jurídico' },
];

describe('lista de quadros', () => {
  it('mantém a chave de sempre no quadro principal', () => {
    expect(boardStorageKey(DEFAULT_BOARD_ID)).toBe(BOARD_STORAGE_KEY);
    expect(boardStorageKey('board-2')).toBe('backoffice:quadro:board-2:v1');
  });

  it('valida o nome sem repetir o de outro quadro', () => {
    expect(validBoardName({ boards, name: '  Novo  ' })).toBe('Novo');
    expect(validBoardName({ boards, name: '   ' })).toBeNull();
    expect(validBoardName({ boards, name: 'operacoes' })).toBeNull();
    expect(
      validBoardName({ boards, name: 'Operações', boardId: 'board-2' }),
    ).toBe('Operações');
  });

  it('cria, renomeia e exclui quadros', () => {
    const added = addBoard({ boards, board: { id: 'board-4', name: ' RH ' } });
    expect(added.at(-1)).toEqual({ id: 'board-4', name: 'RH' });
    expect(
      addBoard({ boards, board: { id: 'board-4', name: 'Jurídico' } }),
    ).toBe(boards);
    expect(addBoard({ boards, board: { id: 'board-1', name: 'Outro' } })).toBe(
      boards,
    );

    expect(
      renameBoard({ boards, boardId: 'board-2', name: 'Ops' })[1]?.name,
    ).toBe('Ops');
    expect(renameBoard({ boards, boardId: 'board-2', name: 'Operações' })).toBe(
      boards,
    );
    expect(renameBoard({ boards, boardId: 'board-9', name: 'X' })).toBe(boards);

    expect(removeBoard({ boards, boardId: 'board-2' })).toHaveLength(2);
    expect(removeBoard({ boards, boardId: 'board-9' })).toBe(boards);
    const single = boards.slice(0, 1);
    expect(removeBoard({ boards: single, boardId: 'board-1' })).toBe(single);
  });

  it('abre o vizinho da esquerda quando o quadro aberto some', () => {
    const after = removeBoard({ boards, boardId: 'board-2' });
    expect(neighborBoard({ before: boards, after, boardId: 'board-2' })).toBe(
      'board-1',
    );
    expect(neighborBoard({ before: boards, after, boardId: 'board-3' })).toBe(
      'board-3',
    );
    const withoutFirst = removeBoard({ boards, boardId: 'board-1' });
    expect(
      neighborBoard({
        before: boards,
        after: withoutFirst,
        boardId: 'board-1',
      }),
    ).toBe('board-2');
  });

  it('grava e lê a lista, recusando a estragada', () => {
    expect(parseStoredBoards(serializeBoards(boards))).toEqual(boards);
    expect(parseStoredBoards(null)).toBeNull();
    expect(parseStoredBoards('{quebrado')).toBeNull();
    expect(parseStoredBoards('{"boards": []}')).toBeNull();
    expect(parseStoredBoards('{"outro": 1}')).toBeNull();
    expect(
      parseStoredBoards(
        JSON.stringify({
          boards: [
            { id: 'a', name: 'A' },
            { id: 'a', name: 'B' },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      parseStoredBoards(
        JSON.stringify({
          boards: [{ id: 'a', name: ' A ' }, { id: 'b', name: '' }, 3],
        }),
      ),
    ).toEqual([{ id: 'a', name: 'A' }]);
  });
});
