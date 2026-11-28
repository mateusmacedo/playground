import {
  type ApiErrorKind,
  type ApiFailure,
  failed,
  succeeded,
} from '@/shared/api/api-result';
import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';

import type { Board } from '../model/board';
import { toBoardDocument } from '../model/board-document';

/** API de quadros simulada, com as regras do contrato: revisão a partir de 1, `If-Match` conferido e id único. */
export interface FakeBoardsApi extends BoardsApi {
  /** O que o servidor simulado tem gravado, por id. */
  readonly documents: Map<string, BoardDocument>;
  /** As chamadas recebidas, na ordem, como `PUT /boards/board-1`. */
  readonly calls: string[];
  /** As próximas chamadas falham com estes erros, um por chamada, sem gravar nada. */
  readonly failNext: (...kinds: ApiErrorKind[]) => void;
  /** A próxima chamada grava no servidor, mas a resposta se perde: quem chamou recebe o erro de rede. */
  readonly loseNextAnswer: () => void;
  /** A próxima chamada só responde depois de a função devolvida ser chamada. */
  readonly holdNext: () => () => void;
}

export interface StoredDocumentParams {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly board: Board;
}

/** Documento como o servidor o guarda: passado por JSON, sem dividir objeto nenhum com o quadro da tela. */
export function storedDocument(params: StoredDocumentParams): BoardDocument {
  const { revision, ...content } = params;
  const document = { ...toBoardDocument(content), revision };
  return JSON.parse(JSON.stringify(document)) as BoardDocument;
}

export function createFakeBoardsApi(): FakeBoardsApi {
  const documents = new Map<string, BoardDocument>();
  const calls: string[] = [];
  const failures: ApiErrorKind[] = [];
  let answerLost = false;
  let held: Promise<void> | null = null;

  const receive = async (call: string): Promise<ApiFailure | null> => {
    calls.push(call);
    const waiting = held;
    held = null;
    await waiting;
    const kind = failures.shift();
    return kind ? failed({ kind }) : null;
  };

  const store = (document: BoardDocument): BoardDocument | ApiFailure => {
    const copy = JSON.parse(JSON.stringify(document)) as BoardDocument;
    documents.set(copy.id, copy);
    if (answerLost) {
      answerLost = false;
      return failed({ kind: 'network' });
    }
    return copy;
  };

  const answer = (stored: BoardDocument | ApiFailure) =>
    'ok' in stored ? stored : succeeded(stored);

  return {
    documents,
    calls,
    failNext: (...kinds) => {
      failures.push(...kinds);
    },
    loseNextAnswer: () => {
      answerLost = true;
    },
    holdNext: () => {
      let release = (): void => undefined;
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    async list() {
      const failure = await receive('GET /boards');
      if (failure) {
        return failure;
      }
      const summaries = [...documents.values()].map((document) => ({
        id: document.id,
        name: document.name,
        revision: document.revision,
      }));
      return succeeded(summaries);
    },
    async create(document) {
      const failure = await receive(`POST /boards ${document.id}`);
      if (failure) {
        return failure;
      }
      if (documents.has(document.id)) {
        return failed({ kind: 'invalid', status: 422 });
      }
      return answer(store({ ...document, revision: 1 }));
    },
    async get(id) {
      const failure = await receive(`GET /boards/${id}`);
      const document = documents.get(id);
      if (failure) {
        return failure;
      }
      return document
        ? succeeded(document)
        : failed({ kind: 'not-found', status: 404 });
    },
    async update(document) {
      const failure = await receive(`PUT /boards/${document.id}`);
      const current = documents.get(document.id);
      if (failure) {
        return failure;
      }
      if (!current) {
        return failed({ kind: 'not-found', status: 404 });
      }
      if (current.revision !== document.revision) {
        return failed({ kind: 'conflict', status: 412 });
      }
      return answer(store({ ...document, revision: document.revision + 1 }));
    },
    async remove(id) {
      const failure = await receive(`DELETE /boards/${id}`);
      if (failure) {
        return failure;
      }
      return documents.delete(id)
        ? succeeded(undefined)
        : failed({ kind: 'not-found', status: 404 });
    },
  };
}
