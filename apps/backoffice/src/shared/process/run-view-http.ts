import type { PanelApi } from '@/shared/api/panel-api';

import { boardHref, readBoardCard } from './board-run';
import type { ProcessVersion } from './catalog';
import { readDefinition } from './definition-documents';
import {
  type RunView,
  type RunViewRefParams,
  runViewRef,
} from './run-view-store';

/** O que a API diz da execução de um card: a situação com o desenho da versão, ou o que falta para mostrá-la. */
export type RemoteRunView =
  | {
      readonly kind: 'ready';
      readonly view: RunView;
      /** Versão do processo em que a execução começou, com o desenho e o roteiro dela. */
      readonly version: ProcessVersion;
    }
  /** A leitura falhou (rede, servidor); dá para tentar de novo. */
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'no-board' }
  | { readonly kind: 'no-card'; readonly boardHref: string }
  | {
      readonly kind: 'no-run';
      readonly cardLabel: string;
      readonly backHref: string;
    }
  /** O servidor não tem o processo ou a versão em que a execução começou. */
  | { readonly kind: 'no-version'; readonly view: RunView };

export interface LoadRunViewParams {
  readonly api: PanelApi;
  readonly ref: RunViewRefParams;
  /** Instante da leitura (ISO 8601); é a hora da situação mostrada. */
  readonly at: string;
}

/**
 * Monta a situação de uma execução com o que a API guarda: o quadro dá o card e a execução dele, e a definição do
 * processo dá o desenho da versão em que a execução começou.
 */
export async function loadRemoteRunView(
  params: LoadRunViewParams,
): Promise<RemoteRunView> {
  const { api, ref, at } = params;
  const board = await api.boards.get(ref.boardId);
  if (!board.ok) {
    return board.error.kind === 'not-found'
      ? { kind: 'no-board' }
      : { kind: 'failed', message: board.error.message };
  }
  const card = readBoardCard({
    boardId: ref.boardId,
    board: board.value.board,
    cardId: ref.cardId,
  });
  if (card === null) {
    return { kind: 'no-card', boardHref: boardHref(ref.boardId) };
  }
  const { run, cardLabel, backHref } = card;
  if (run === undefined) {
    return { kind: 'no-run', cardLabel, backHref };
  }
  const view: RunView = {
    ref: runViewRef(ref),
    definitionId: run.definitionId,
    version: run.version,
    processName: run.name,
    cardLabel,
    backHref,
    run,
    savedAt: at,
  };
  const document = await api.processDefinitions.get(run.definitionId);
  if (!document.ok) {
    return document.error.kind === 'not-found'
      ? { kind: 'no-version', view }
      : { kind: 'failed', message: document.error.message };
  }
  const definition = readDefinition(document.value);
  const version = definition?.versions.find(
    (item) => item.version === run.version,
  );
  return version === undefined
    ? { kind: 'no-version', view }
    : { kind: 'ready', view, version };
}
