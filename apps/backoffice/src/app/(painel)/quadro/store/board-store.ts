import type { Board } from '../model/board';

/**
 * O que a leitura do quadro devolveu. Com `empty` não há quadro gravado que dê para ler: a tela segue com o quadro
 * que já tem, e ele passa a ser o gravado. Com `failed`, `message` é o motivo, em uma frase para a tela.
 */
export type BoardLoad =
  | { readonly kind: 'found'; readonly board: Board }
  | { readonly kind: 'empty' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Situação da gravação do quadro que está na tela. `pending` tem mudança esperando ou sendo gravada; `conflict` é o
 * quadro que mudou em outro lugar depois de lido. `busy` marca a nova tentativa, ou a saída do conflito, em andamento.
 */
export type SaveStatus =
  | { readonly kind: 'saved' }
  | { readonly kind: 'pending' }
  | {
      readonly kind: 'failed';
      readonly message: string;
      readonly busy: boolean;
    }
  | {
      readonly kind: 'conflict';
      readonly busy: boolean;
      /** Motivo pelo qual a última saída escolhida não deu certo. */
      readonly failure?: string;
    };

export const SAVED: SaveStatus = { kind: 'saved' };

/** O que só existe quando o quadro é gravado num servidor, com espera, falha e outra pessoa gravando ao mesmo tempo. */
export interface RemoteBoardActions {
  /**
   * Relê o quadro quando a pessoa volta para a aba. Devolve o quadro só quando o servidor tem uma versão mais nova e
   * a tela não tem mudança por gravar; `null` em todo outro caso, inclusive quando a leitura falha.
   */
  readonly refresh: () => Promise<Board | null>;
  readonly retry: () => void;
  /** Saída do conflito: grava a versão da tela por cima da que está no servidor. */
  readonly keepMine: () => void;
  /** Saída do conflito: descarta a versão da tela e devolve a do servidor; `null` quando a leitura falha. */
  readonly takeTheirs: () => Promise<Board | null>;
  /**
   * Envia agora o que espera para ser gravado e termina quando não há mais envio pendente, tenha ele dado certo ou
   * não: o desfecho está em `status`. É o que a tela chama ao sair e antes de abrir o que lê o quadro do servidor.
   */
  readonly flush: () => Promise<void>;
}

/**
 * Porta do conteúdo de um quadro: onde ele é lido e gravado. A leitura é sempre assíncrona; a gravação não bloqueia
 * a tela, e o desfecho dela chega por `status` e `subscribe`.
 */
export interface BoardStore {
  readonly load: () => Promise<BoardLoad>;
  /** O quadro que a própria porta entregou (por `load`, `watch` ou `remote`) não é gravado de volta. */
  readonly save: (board: Board) => void;
  readonly status: () => SaveStatus;
  readonly subscribe: (listener: () => void) => () => void;
  /** Avisa quando outra aba grava o quadro; só o armazenamento que avisa tem. */
  readonly watch?: (onChange: (board: Board) => void) => () => void;
  /** Sem ele, o quadro fica no navegador: a leitura não espera nem falha. */
  readonly remote?: RemoteBoardActions;
}
