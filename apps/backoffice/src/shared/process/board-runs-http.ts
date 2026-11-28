import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardSummary } from '@/shared/api/contract';

import {
  type BoardEntry,
  type BoardRunsSource,
  collectRuns,
} from './board-runs-source';

/** Quantos quadros são lidos ao mesmo tempo: o bastante para não esperar um por um, sem pedir todos de uma vez. */
export const BOARD_READ_LIMIT = 4;

interface InTurnsParams<T, R> {
  readonly items: readonly T[];
  /** Quantos rodam ao mesmo tempo. */
  readonly limit: number;
  readonly run: (item: T) => Promise<R>;
}

/** Roda `run` para cada item, no máximo `limit` de cada vez, e devolve os resultados na ordem dos itens. */
async function inTurns<T, R>(params: InTurnsParams<T, R>): Promise<R[]> {
  const { items, limit, run } = params;
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  };
  const workers: Promise<void>[] = [];
  const count = Math.min(limit, items.length);
  for (let started = 0; started < count; started += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

interface BoardRead {
  readonly entry: BoardEntry;
  /** Por que o quadro não foi lido, no texto pronto para a tela; só na leitura que falhou. */
  readonly failure?: string;
}

interface ReadBoardParams {
  readonly api: BoardsApi;
  readonly summary: BoardSummary;
}

async function readBoard(params: ReadBoardParams): Promise<BoardRead> {
  const { api, summary } = params;
  const { id, name } = summary;
  const result = await api.get(id);
  if (result.ok) {
    const { board } = result.value;
    return {
      entry: { id, name: result.value.name, content: { kind: 'read', board } },
    };
  }
  if (result.error.kind === 'not-found') {
    return { entry: { id, name, content: { kind: 'absent' } } };
  }
  return {
    entry: { id, name, content: { kind: 'unread' } },
    failure: result.error.message,
  };
}

/**
 * As execuções lidas da API do painel: a lista de quadros e, depois, cada quadro. A falha de um quadro não derruba a
 * lista: os outros aparecem, e o nome dele vai para os que não deu para ler. A leitura só falha inteira quando a lista
 * de quadros falha, ou quando nenhum quadro pôde ser lido.
 */
export function createHttpBoardRunsSource(api: BoardsApi): BoardRunsSource {
  return {
    async load(at) {
      const list = await api.list();
      if (!list.ok) {
        return { kind: 'failed', message: list.error.message };
      }
      const reads = await inTurns({
        items: list.value,
        limit: BOARD_READ_LIMIT,
        run: (summary: BoardSummary) => readBoard({ api, summary }),
      });
      const someRead = reads.some((read) => read.entry.content.kind === 'read');
      const failure = reads.find((read) => read.failure !== undefined)?.failure;
      if (!someRead && failure !== undefined) {
        return { kind: 'failed', message: failure };
      }
      const entries = reads.map((read) => read.entry);
      return collectRuns({ entries, at });
    },
  };
}
