// NOTE: fica fora da pasta do quadro porque a lista de execuções lê o que ele grava no navegador sem importá-lo.

/** Quadro que já existia antes de haver vários: continua com a chave de sempre, sem precisar migrar o que foi gravado. */
export const DEFAULT_BOARD_ID = 'board-1';

export const BOARD_STORAGE_KEY = 'backoffice:quadro:v1';

/** Lista de quadros, compartilhada entre as abas. */
export const BOARDS_STORAGE_KEY = 'backoffice:quadros:v1';

export function boardStorageKey(boardId: string): string {
  return boardId === DEFAULT_BOARD_ID
    ? BOARD_STORAGE_KEY
    : `backoffice:quadro:${boardId}:v1`;
}
