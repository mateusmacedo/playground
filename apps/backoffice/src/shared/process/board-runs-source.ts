import {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
  DEFAULT_BOARD_ID,
} from '@/shared/board/storage-keys';

import { type BoardRun, boardRunsOf, sortRuns } from './board-runs';
import { isFilledText, isRecord, keepValid } from './stored-values';

/** As execuções em andamento que a leitura achou. */
export interface LoadedBoardRuns {
  readonly kind: 'loaded';
  /** As atrasadas primeiro; depois, as iniciadas há mais tempo. */
  readonly runs: readonly BoardRun[];
  /** Nomes dos quadros que não deu para ler: com algum, a lista pode estar incompleta. */
  readonly unreadBoards: readonly string[];
}

export type BoardRunsReading =
  | LoadedBoardRuns
  /** A leitura inteira falhou (rede, servidor); dá para tentar de novo. */
  | { readonly kind: 'failed'; readonly message: string };

/** Por onde a lista de execuções lê os quadros: a API do painel ou o que o quadro gravou neste navegador. */
export interface BoardRunsSource {
  /** Lê as execuções em andamento de todos os quadros; `at` é o instante da leitura (ISO 8601). */
  readonly load: (at: string) => Promise<BoardRunsReading>;
}

/** O que a leitura conseguiu de um quadro. */
export type BoardContent =
  | { readonly kind: 'read'; readonly board: unknown }
  /** O quadro existe, mas não deu para ler o conteúdo dele. */
  | { readonly kind: 'unread' }
  /** O quadro não tem conteúdo gravado, ou saiu do servidor depois de a lista ser lida. */
  | { readonly kind: 'absent' };

export interface BoardEntry {
  readonly id: string;
  readonly name: string;
  readonly content: BoardContent;
}

export interface CollectRunsParams {
  readonly entries: readonly BoardEntry[];
  /** Instante da leitura (ISO 8601), para dizer o que está atrasado. */
  readonly at: string;
}

/** Junta as execuções em andamento dos quadros lidos, na ordem da lista, e os nomes dos que não deu para ler. */
export function collectRuns(params: CollectRunsParams): LoadedBoardRuns {
  const { entries, at } = params;
  const runs: BoardRun[] = [];
  const unreadBoards: string[] = [];
  for (const entry of entries) {
    const { content } = entry;
    if (content.kind === 'unread') {
      unreadBoards.push(entry.name);
    }
    if (content.kind === 'read') {
      const found = boardRunsOf({
        boardId: entry.id,
        boardName: entry.name,
        board: content.board,
        at,
      });
      runs.push(...found);
    }
  }
  return { kind: 'loaded', runs: sortRuns(runs), unreadBoards };
}

type StoredBoard = Pick<BoardEntry, 'id' | 'name'>;

// NOTE: o nome do quadro principal é repetido aqui porque esta pasta não importa nada do quadro, que é quem o define.
const DEFAULT_BOARDS: readonly StoredBoard[] = [
  { id: DEFAULT_BOARD_ID, name: 'Quadro principal' },
];

function readText(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // WHY: armazenamento bloqueado (modo privado, política do navegador) é o mesmo que não ter nada gravado.
    return null;
  }
}

/** O texto gravado, já lido como JSON; `undefined` quando o texto está estragado. */
function parseText(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // WHY: o texto estragado não interrompe a lista; quem chama decide o que ele vale.
    return undefined;
  }
}

function toStoredBoard(value: unknown): StoredBoard | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    !isFilledText(value.name)
  ) {
    return null;
  }
  return { id: value.id, name: value.name.trim() };
}

/**
 * Lista de quadros gravada no navegador. Sem lista, ou com ela estragada, vazia ou com id repetido, vale o quadro
 * principal, que é como o quadro lê a mesma chave.
 */
function storedBoards(): readonly StoredBoard[] {
  const raw = readText(BOARDS_STORAGE_KEY);
  const data = raw === null ? undefined : parseText(raw);
  if (!isRecord(data)) {
    return DEFAULT_BOARDS;
  }
  const boards = keepValid({ value: data.boards, parse: toStoredBoard });
  if (boards === undefined) {
    return DEFAULT_BOARDS;
  }
  const ids = new Set(boards.map((board) => board.id));
  return ids.size === boards.length ? boards : DEFAULT_BOARDS;
}

function storedContent(boardId: string): BoardContent {
  const raw = readText(boardStorageKey(boardId));
  if (raw === null || raw === '') {
    return { kind: 'absent' };
  }
  const data = parseText(raw);
  if (!isRecord(data)) {
    return { kind: 'unread' };
  }
  // NOTE: o formato mais antigo (`{ version: 1, lanes }`) não tem `board` nem processos, e é lido como quadro sem
  // execução.
  return { kind: 'read', board: data.board };
}

/** As execuções lidas do que o quadro gravou no `localStorage`: a lista de quadros e o conteúdo de cada um. */
export function createBrowserBoardRunsSource(): BoardRunsSource {
  return {
    async load(at) {
      const entries: BoardEntry[] = [];
      for (const board of storedBoards()) {
        entries.push({ ...board, content: storedContent(board.id) });
      }
      return collectRuns({ entries, at });
    },
  };
}
