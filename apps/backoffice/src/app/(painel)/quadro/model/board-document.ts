import type { BoardDocument, NewBoardDocument } from '@/shared/api/contract';

import type { Board } from './board';
import { BOARD_VERSION, readStoredBoard } from './storage';

export interface BoardDocumentParams {
  readonly id: string;
  readonly name: string;
  readonly board: Board;
}

/** O quadro como documento da API, ainda sem revisão: o conteúdo vai no formato em que o navegador o grava. */
export function toBoardDocument(params: BoardDocumentParams): NewBoardDocument {
  const { id, name, board } = params;
  return { id, name, schemaVersion: BOARD_VERSION, board };
}

/** As partes do documento que dizem como ler o quadro. */
export type BoardDocumentContent = Pick<
  BoardDocument,
  'schemaVersion' | 'board'
>;

/**
 * Lê o quadro de um documento da API com a mesma conferência do que é lido do navegador; `null` quando a versão do
 * formato é desconhecida ou o conteúdo não forma um quadro coerente.
 */
export function boardOfDocument(document: BoardDocumentContent): Board | null {
  return readStoredBoard({
    version: document.schemaVersion,
    board: document.board,
  });
}
