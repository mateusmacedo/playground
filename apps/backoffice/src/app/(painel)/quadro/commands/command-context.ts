import type { Board, BoardLane } from '../model/board';

/** Mudança pedida ao quadro, que vira um passo do desfazer. */
export interface BoardChange {
  readonly update: (current: Board) => Board;
  /** Mudanças seguidas com a mesma chave entram no mesmo passo. */
  readonly key?: string;
  /** Registra a mudança no histórico dos cards; ligado quando ausente. */
  readonly log?: boolean;
  /**
   * Passa a mudança pelas regras do quadro (a guarda da coluna de conclusão e o que a mudança provoca); ligado quando
   * ausente. Só a troca do quadro inteiro dispensa.
   */
  readonly rules?: boolean;
}

/** Mudança que só mexe nas colunas e nos cards delas. */
export interface LanesOnlyChange {
  readonly update: (lanes: readonly BoardLane[]) => readonly BoardLane[];
  readonly key?: string;
}

export interface CommandContext {
  /** O quadro como está na tela agora; serve para calcular os ids novos e responder a quem pediu. */
  readonly board: Board;
  readonly commit: (change: BoardChange) => void;
  readonly commitLanes: (change: LanesOnlyChange) => void;
  /** Avisa a tela de que o quadro recusou o pedido, com o motivo em uma frase. */
  readonly refuse: (text: string) => void;
}
