import {
  type ApiErrorKind,
  type ApiFailure,
  failed,
  succeeded,
} from '@/shared/api/api-result';
import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';

/** API de quadros em memória para os testes de quem só lê um quadro. */
export interface FakeBoardsApi extends BoardsApi {
  /** Ids dos quadros lidos, na ordem. */
  readonly reads: string[];
  /** Troca ou acrescenta o quadro, como outro cliente faria. */
  readonly put: (document: BoardDocument) => void;
  /** A próxima leitura de um quadro falha com o caso de erro. */
  readonly failNext: (kind: ApiErrorKind) => void;
}

export function fakeBoardsApi(
  initial: readonly BoardDocument[] = [],
): FakeBoardsApi {
  const documents = new Map<string, BoardDocument>();
  const reads: string[] = [];
  const failures: ApiErrorKind[] = [];
  const unsupported = async (): Promise<ApiFailure> =>
    failed({ kind: 'unexpected' });

  for (const document of initial) {
    documents.set(document.id, document);
  }

  return {
    reads,
    put: (document) => {
      documents.set(document.id, document);
    },
    failNext: (kind) => {
      failures.push(kind);
    },
    async get(id) {
      reads.push(id);
      const failure = failures.shift();
      if (failure !== undefined) {
        return failed({ kind: failure });
      }
      const document = documents.get(id);
      return document === undefined
        ? failed({ kind: 'not-found', status: 404 })
        : succeeded(document);
    },
    list: unsupported,
    create: unsupported,
    update: unsupported,
    remove: unsupported,
  };
}
