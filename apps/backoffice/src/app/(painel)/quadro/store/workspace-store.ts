import type { Board } from '../model/board';
import type { WorkspaceBoard } from '../model/workspace';
import type { BoardStore } from './board-store';

/** O que a leitura da lista devolveu; a lista lida nunca vem vazia, e `message` é o motivo da falha para a tela. */
export type BoardListLoad =
  | { readonly kind: 'found'; readonly boards: readonly WorkspaceBoard[] }
  | { readonly kind: 'failed'; readonly message: string };

export interface CreateStoredBoardParams {
  /** A lista já com o quadro novo. */
  readonly boards: readonly WorkspaceBoard[];
  readonly board: WorkspaceBoard;
  readonly content: Board;
}

export interface RenameStoredBoardParams {
  /** A lista já com o nome novo. */
  readonly boards: readonly WorkspaceBoard[];
  readonly boardId: string;
  readonly name: string;
}

export interface RemoveStoredBoardParams {
  /** A lista já sem o quadro. */
  readonly boards: readonly WorkspaceBoard[];
  readonly boardId: string;
}

/** O que só existe quando os quadros ficam num servidor. */
export interface RemoteWorkspaceActions {
  /**
   * Relê a lista quando a pessoa volta para a aba. Devolve `null` quando a leitura falha e quando há mudança por
   * gravar ou exclusão em andamento, porque a lista do servidor ainda não as mostraria.
   */
  readonly refreshList: () => Promise<readonly WorkspaceBoard[] | null>;
}

/**
 * Porta dos quadros do painel: a lista, as mudanças nela e o conteúdo de cada quadro. A leitura é sempre assíncrona;
 * criar e renomear não bloqueiam a tela, e a falha deles aparece na gravação do próprio quadro (`board`).
 */
export interface WorkspaceStore {
  readonly loadList: () => Promise<BoardListLoad>;
  readonly create: (params: CreateStoredBoardParams) => void;
  readonly rename: (params: RenameStoredBoardParams) => void;
  /** Apaga o quadro com tudo o que foi gravado nele; devolve o motivo, para a tela, quando não consegue. */
  readonly remove: (params: RemoveStoredBoardParams) => Promise<string | null>;
  /** O conteúdo do quadro; o mesmo id devolve sempre o mesmo objeto. */
  readonly board: (boardId: string) => BoardStore;
  /** Avisa quando outra aba muda a lista; só o armazenamento que avisa tem. */
  readonly watchList?: (
    onChange: (boards: readonly WorkspaceBoard[]) => void,
  ) => () => void;
  /** Sem ele, os quadros ficam no navegador: a leitura não espera nem falha. */
  readonly remote?: RemoteWorkspaceActions;
}
