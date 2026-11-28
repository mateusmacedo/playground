import { type ApiResult, failed, succeeded } from '@/shared/api/api-result';
import type { BoardsApi } from '@/shared/api/boards-api';
import type { BoardDocument } from '@/shared/api/contract';

import type { Board } from '../model/board';

/** O que vai para o servidor num envio: o quadro e o nome dele, que mora no mesmo documento. */
export interface BoardSnapshot {
  readonly name: string;
  readonly board: Board;
}

interface IsSameDocumentParams {
  readonly document: BoardDocument;
  readonly sent: BoardSnapshot;
}

function isSameDocument(params: IsSameDocumentParams): boolean {
  const { document, sent } = params;
  return (
    document.name === sent.name &&
    JSON.stringify(document.board) === JSON.stringify(sent.board)
  );
}

export interface ConfirmSentWriteParams {
  readonly api: BoardsApi;
  readonly boardId: string;
  /** Revisão que o servidor tinha antes do envio; `null` quando o envio criava o quadro. */
  readonly revision: number | null;
  readonly sent: BoardSnapshot;
}

/**
 * Depois de um envio que ficou sem resposta (sem rede, tempo esgotado), lê o servidor para saber se ele chegou.
 * Devolve o documento gravado quando chegou, `null` quando não chegou, e o erro `conflict` quando o servidor tem outra
 * coisa no lugar.
 *
 * WHY: repetir às cegas um envio que chegou seria recusado pela revisão, e a tela acusaria conflito com a própria
 * gravação.
 */
export async function confirmSentWrite(
  params: ConfirmSentWriteParams,
): Promise<ApiResult<BoardDocument | null>> {
  const { api, boardId, revision, sent } = params;
  const current = await api.get(boardId);
  if (!current.ok) {
    const neverCreated =
      revision === null && current.error.kind === 'not-found';
    return neverCreated ? succeeded(null) : current;
  }
  const document = current.value;
  if (document.revision === revision) {
    return succeeded(null);
  }
  const expected = (revision ?? 0) + 1;
  const landed =
    document.revision === expected && isSameDocument({ document, sent });
  return landed ? succeeded(document) : failed({ kind: 'conflict' });
}
