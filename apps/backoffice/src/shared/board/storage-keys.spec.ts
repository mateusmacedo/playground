import {
  BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  DEFAULT_BOARD_ID,
} from './storage-keys';

describe('chaves do quadro no navegador', () => {
  it('mantém as chaves em que o quadro já grava', () => {
    expect(DEFAULT_BOARD_ID).toBe('board-1');
    expect(BOARD_STORAGE_KEY).toBe('backoffice:quadro:v1');
    expect(BOARDS_STORAGE_KEY).toBe('backoffice:quadros:v1');
  });
});

describe('boardStorageKey', () => {
  it('dá ao quadro principal a chave de sempre', () => {
    expect(boardStorageKey(DEFAULT_BOARD_ID)).toBe(BOARD_STORAGE_KEY);
  });

  it('dá a cada outro quadro uma chave com o id dele', () => {
    expect(boardStorageKey('board-2')).toBe('backoffice:quadro:board-2:v1');
  });
});
