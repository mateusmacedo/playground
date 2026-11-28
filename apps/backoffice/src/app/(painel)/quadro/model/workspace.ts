import {
  BOARDS_STORAGE_KEY,
  DEFAULT_BOARD_ID,
} from '@/shared/board/storage-keys';

import { normalizeText } from './search';

/** Um quadro na lista de quadros: o conteúdo e a configuração ficam gravados à parte, na chave do próprio quadro. */
export interface WorkspaceBoard {
  readonly id: string;
  readonly name: string;
}

// NOTE: as chaves moram em `src/shared`, porque a lista de execuções também lê o que o quadro grava no navegador.
export {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  DEFAULT_BOARD_ID,
} from '@/shared/board/storage-keys';

export const DEFAULT_BOARD: WorkspaceBoard = {
  id: DEFAULT_BOARD_ID,
  name: 'Quadro principal',
};

export const DEFAULT_BOARDS: readonly WorkspaceBoard[] = [DEFAULT_BOARD];

/** Quadro aberto por último, só desta tela: cada aba pode estar num quadro diferente. */
export const ACTIVE_BOARD_STORAGE_KEY = `${BOARDS_STORAGE_KEY}:ativo`;

export interface ValidBoardNameParams {
  readonly boards: readonly WorkspaceBoard[];
  readonly name: string;
  readonly boardId?: string;
}

/** Nome sem espaços nas pontas; `null` quando vazio ou igual ao de outro quadro (sem contar maiúsculas e acentos). */
export function validBoardName(params: ValidBoardNameParams): string | null {
  const name = params.name.trim();
  const taken = params.boards.some(
    (board) =>
      board.id !== params.boardId &&
      normalizeText(board.name) === normalizeText(name),
  );
  return name && !taken ? name : null;
}

export interface AddBoardParams {
  readonly boards: readonly WorkspaceBoard[];
  readonly board: WorkspaceBoard;
}

export function addBoard(params: AddBoardParams): readonly WorkspaceBoard[] {
  const name = validBoardName({
    boards: params.boards,
    name: params.board.name,
  });
  return name && !params.boards.some((board) => board.id === params.board.id)
    ? [...params.boards, { id: params.board.id, name }]
    : params.boards;
}

export interface RenameBoardParams {
  readonly boards: readonly WorkspaceBoard[];
  readonly boardId: string;
  readonly name: string;
}

export function renameBoard(
  params: RenameBoardParams,
): readonly WorkspaceBoard[] {
  const name = validBoardName(params);
  const current = params.boards.find((board) => board.id === params.boardId);
  if (!name || !current || current.name === name) {
    return params.boards;
  }
  return params.boards.map((board) =>
    board.id === params.boardId ? { ...board, name } : board,
  );
}

export interface RemoveBoardParams {
  readonly boards: readonly WorkspaceBoard[];
  readonly boardId: string;
}

/** Tira o quadro da lista; o último quadro não pode sair. */
export function removeBoard(
  params: RemoveBoardParams,
): readonly WorkspaceBoard[] {
  const boards = params.boards.filter((board) => board.id !== params.boardId);
  return boards.length > 0 && boards.length < params.boards.length
    ? boards
    : params.boards;
}

export interface NeighborBoardParams {
  readonly before: readonly WorkspaceBoard[];
  readonly after: readonly WorkspaceBoard[];
  readonly boardId: string;
}

/** Quadro que fica aberto quando o quadro de `boardId` some: o vizinho da esquerda, ou o primeiro. */
export function neighborBoard(params: NeighborBoardParams): string | undefined {
  const { before, after, boardId } = params;
  const stillThere = after.some((board) => board.id === boardId);
  if (stillThere) {
    return boardId;
  }
  const removedIndex = before.findIndex((board) => board.id === boardId);
  for (let index = removedIndex - 1; index >= 0; index -= 1) {
    const candidate = before[index];
    if (candidate && after.includes(candidate)) {
      return candidate.id;
    }
  }
  return after[0]?.id;
}

export function serializeBoards(boards: readonly WorkspaceBoard[]): string {
  return JSON.stringify({ version: 1, boards });
}

/** Um quadro da lista gravada; `undefined` quando o item não tem id e nome válidos. */
function toWorkspaceBoard(item: unknown): WorkspaceBoard | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined;
  }
  if (!('id' in item) || !('name' in item)) {
    return undefined;
  }
  if (typeof item.id !== 'string' || typeof item.name !== 'string') {
    return undefined;
  }
  const name = item.name.trim();
  if (name === '') {
    return undefined;
  }
  return { id: item.id, name };
}

/** Lê a lista gravada; `null` quando não há nada, quando está estragada ou quando repete ids. */
export function parseStoredBoards(
  raw: string | null,
): readonly WorkspaceBoard[] | null {
  if (!raw) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    !('boards' in data) ||
    !Array.isArray(data.boards)
  ) {
    return null;
  }
  const boards: WorkspaceBoard[] = [];
  for (const item of data.boards as unknown[]) {
    const board = toWorkspaceBoard(item);
    if (board) {
      boards.push(board);
    }
  }
  const ids = new Set(boards.map((board) => board.id));
  const hasRepeatedIds = ids.size !== boards.length;
  if (boards.length === 0 || hasRepeatedIds) {
    return null;
  }
  return boards;
}
