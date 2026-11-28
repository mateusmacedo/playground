import { type ApiErrorKind, failed, succeeded } from '@/shared/api/api-result';
import type { BoardDocument, BoardSummary } from '@/shared/api/contract';
import {
  BOARDS_STORAGE_KEY,
  boardStorageKey,
} from '@/shared/board/storage-keys';

import { type FakeBoardsApi, fakeBoardsApi } from './boards-api-fake';
import { begin, end, planOf, step } from './engine-test-kit';
import type { ProcessPlan } from './plan';
import type { ProcessRun } from './run';

/** Roteiro de teste: Início > Separar > Entregar > Fim. "Separar" tem prazo de 1 hora. */
export const deliveryPlan: ProcessPlan = planOf([
  step({ id: 'start', kind: 'start', to: 'pick' }),
  step({
    id: 'pick',
    to: 'ship',
    data: { label: 'Separar', dueIn: { amount: 1, unit: 'hours' } },
  }),
  step({ id: 'ship', to: 'end', data: { label: 'Entregar' } }),
  end({ id: 'end' }),
]);

/**
 * Execução do roteiro de entrega, parada em "Separar" desde `STARTED_AT` do motor de teste; `overrides` troca só o que
 * o teste precisa.
 */
export function deliveryRun(overrides: Partial<ProcessRun> = {}): ProcessRun {
  return { ...begin(deliveryPlan), ...overrides };
}

/** O roteiro como o quadro o guarda, na versão das execuções de teste. */
export function storedPlan(plan: ProcessPlan): Record<string, unknown> {
  return { definitionId: 'process-1', version: 1, name: 'Processo', plan };
}

export interface TestBoardParams {
  /** Cards da coluna, como gravados; podem vir fora do formato, para testar a leitura tolerante. */
  readonly cards: readonly unknown[];
  /** Roteiros guardados no quadro; sem valor, o de entrega. */
  readonly processes?: unknown;
}

/** Conteúdo de um quadro como o painel grava, com os cards numa coluna só. */
export function testBoard(params: TestBoardParams): Record<string, unknown> {
  const { cards, processes = [storedPlan(deliveryPlan)] } = params;
  return {
    lanes: [{ id: 'doing', title: 'Fazendo', cards }],
    archive: [],
    labels: [],
    nextNumber: 100,
    config: { keyPrefix: 'QD' },
    processes,
  };
}

export interface TestBoardDocument {
  readonly id: string;
  readonly name: string;
  readonly board: unknown;
}

export function boardDocument(params: TestBoardDocument): BoardDocument {
  return { ...params, revision: 1, schemaVersion: 3 };
}

/** Grava no navegador a lista de quadros e o conteúdo de cada um, como o quadro faz; sem `board`, só entra na lista. */
export function storeBoards(boards: readonly TestBoardDocument[]): void {
  const list: Pick<TestBoardDocument, 'id' | 'name'>[] = [];
  for (const { id, name, board } of boards) {
    list.push({ id, name });
    if (board !== undefined) {
      window.localStorage.setItem(
        boardStorageKey(id),
        JSON.stringify({ version: 3, board }),
      );
    }
  }
  window.localStorage.setItem(
    BOARDS_STORAGE_KEY,
    JSON.stringify({ version: 1, boards: list }),
  );
}

/** API de quadros em memória que também responde a lista, para os testes de quem lê todos os quadros. */
export interface FakeBoardsListApi extends FakeBoardsApi {
  /** A próxima leitura da lista de quadros falha com o caso de erro. */
  readonly failNextList: (kind: ApiErrorKind) => void;
}

export function fakeBoardsListApi(
  initial: readonly BoardDocument[] = [],
): FakeBoardsListApi {
  const base = fakeBoardsApi(initial);
  const listed = new Map<string, BoardSummary>();
  const failures: ApiErrorKind[] = [];
  const remember = (document: BoardDocument): void => {
    const { id, name, revision } = document;
    listed.set(id, { id, name, revision });
  };

  for (const document of initial) {
    remember(document);
  }

  return {
    ...base,
    put: (document) => {
      remember(document);
      base.put(document);
    },
    failNextList: (kind) => {
      failures.push(kind);
    },
    async list() {
      const failure = failures.shift();
      return failure === undefined
        ? succeeded([...listed.values()])
        : failed({ kind: failure });
    },
  };
}
