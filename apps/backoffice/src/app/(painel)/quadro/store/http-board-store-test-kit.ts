import type { BoardDocument } from '@/shared/api/contract';

import type { Board } from '../model/board';
import { createBoard } from '../model/board-state';
import type { BoardLoad } from './board-store';
import {
  createFakeBoardsApi,
  type FakeBoardsApi,
  storedDocument,
} from './boards-api-test-kit';
import { createHttpBoardStore, type HttpBoardStore } from './http-board-store';

/** Espera entre a mudança e o envio nos testes. */
export const WRITE_DELAY = 200;

export const BOARD_ID = 'board-1';

/** Revisão em que o quadro de teste começa no servidor simulado. */
export const FIRST_REVISION = 3;

/** Quadro de uma coluna só, com o título dado: o título é o que os testes comparam. */
export function titled(title: string): Board {
  return createBoard({ lanes: [{ id: 'todo', title, cards: [] }] });
}

/** Título da coluna do quadro que o servidor simulado tem gravado. */
export function serverTitle(api: FakeBoardsApi): string | undefined {
  const board = api.documents.get(BOARD_ID)?.board as Board | undefined;
  return board?.lanes[0]?.title;
}

export function serverRevision(api: FakeBoardsApi): number | undefined {
  return api.documents.get(BOARD_ID)?.revision;
}

/** Outra pessoa grava o quadro no servidor: a revisão sobe e o conteúdo muda. */
export function otherClientWrites(api: FakeBoardsApi): void {
  const current = api.documents.get(BOARD_ID) as BoardDocument;
  api.documents.set(
    BOARD_ID,
    storedDocument({
      id: BOARD_ID,
      name: 'Vendas',
      revision: current.revision + 1,
      board: titled('De outra pessoa'),
    }),
  );
}

export interface ClosedStore {
  readonly api: FakeBoardsApi;
  readonly store: HttpBoardStore;
}

/** Servidor simulado com o quadro "A fazer" na revisão inicial, e o armazenamento dele ainda sem ler nada. */
export function closedStore(): ClosedStore {
  const api = createFakeBoardsApi();
  api.documents.set(
    BOARD_ID,
    storedDocument({
      id: BOARD_ID,
      name: 'Vendas',
      revision: FIRST_REVISION,
      board: titled('A fazer'),
    }),
  );
  const store = createHttpBoardStore({
    api,
    boardId: BOARD_ID,
    writeDelayMs: WRITE_DELAY,
  });
  return { api, store };
}

type FoundBoard = Extract<BoardLoad, { kind: 'found' }>;

export interface OpenStore extends ClosedStore {
  /** O quadro que a leitura entregou à tela. */
  readonly board: Board;
}

/** O armazenamento com o quadro já lido, como a tela o deixa ao abrir; a lista de chamadas recomeça vazia. */
export async function openStore(): Promise<OpenStore> {
  const { api, store } = closedStore();
  const result = await store.load();
  expect(result.kind).toBe('found');
  api.calls.length = 0;
  return { api, store, board: (result as FoundBoard).board };
}

/** Avança o relógio simulado e deixa os envios em andamento terminarem. */
export async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Leva o armazenamento ao conflito: outra pessoa grava, e a mudança desta tela é recusada. */
export async function conflicted(): Promise<OpenStore> {
  const open = await openStore();
  otherClientWrites(open.api);
  open.store.save(titled('Minha'));
  await advance(WRITE_DELAY);
  open.api.calls.length = 0;
  return open;
}
