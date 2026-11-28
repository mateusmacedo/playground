import {
  isFilledText,
  isPositiveInteger,
  isRecord,
} from '@/shared/process/stored-values';

import type { ApiResult } from './api-result';
import type { BoardDocument, BoardSummary, NewBoardDocument } from './contract';
import {
  createDocumentResource,
  type EnvelopeSource,
  readEnvelope,
} from './document-resource';
import type { HttpClient } from './http-client';

export interface BoardsApi {
  /** `GET /boards`: o resumo de cada quadro. O item fora do contrato fica de fora, sem derrubar os outros. */
  readonly list: () => Promise<ApiResult<readonly BoardSummary[]>>;
  /** `POST /boards`: grava o quadro novo na revisão 1. */
  readonly create: (
    document: NewBoardDocument,
  ) => Promise<ApiResult<BoardDocument>>;
  /** `GET /boards/{id}`. */
  readonly get: (id: string) => Promise<ApiResult<BoardDocument>>;
  /**
   * `PUT /boards/{id}`: `document.revision` é a revisão lida, e a resposta traz o quadro já na seguinte. Renomear o
   * quadro é regravá-lo com o `name` novo.
   */
  readonly update: (
    document: BoardDocument,
  ) => Promise<ApiResult<BoardDocument>>;
  /** `DELETE /boards/{id}`. */
  readonly remove: (id: string) => Promise<ApiResult<void>>;
}

function toBoardDocument(source: EnvelopeSource): BoardDocument | null {
  const envelope = readEnvelope(source);
  if (envelope === null || !isFilledText(envelope.fields.name)) {
    return null;
  }
  return {
    id: envelope.id,
    name: envelope.fields.name,
    revision: envelope.revision,
    schemaVersion: envelope.schemaVersion,
    board: envelope.fields.board,
  };
}

function toBoardSummary(value: unknown): BoardSummary | null {
  if (
    !isRecord(value) ||
    !isFilledText(value.id) ||
    !isFilledText(value.name) ||
    !isPositiveInteger(value.revision)
  ) {
    return null;
  }
  return { id: value.id, name: value.name, revision: value.revision };
}

export function createBoardsApi(client: HttpClient): BoardsApi {
  const resource = createDocumentResource({
    client,
    path: '/boards',
    read: toBoardDocument,
  });
  return {
    list: () => resource.list(toBoardSummary),
    create: resource.create,
    get: resource.get,
    update: resource.update,
    remove: resource.remove,
  };
}
