import { withActivity } from './activity';
import type { Board, BoardLane } from './board';
import {
  dropCoalesced,
  type History,
  isCoalescing,
  recordChange,
} from './history';
import { respectsLocks } from './lane-state';

/** Mesmas colunas, uma a uma: a lista pode ter sido remontada sem mudar nenhuma delas. */
function sameLanes(a: readonly BoardLane[], b: readonly BoardLane[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((lane, index) => lane === b[index]);
}

/** Mesmo conteúdo, sem contar o histórico dos cards. */
function sameContent(a: Board, b: Board): boolean {
  return (
    sameLanes(a.lanes, b.lanes) &&
    a.archive === b.archive &&
    a.labels === b.labels &&
    a.nextNumber === b.nextNumber &&
    a.config === b.config
  );
}

export interface ApplyChangeParams {
  readonly history: History<Board>;
  /** O quadro depois da mudança. */
  readonly next: Board;
  /** Mudanças seguidas com a mesma chave entram no mesmo passo do desfazer. */
  readonly key?: string;
  /** Registra a mudança no histórico dos cards. */
  readonly log: boolean;
  /** Data e hora da mudança, ISO 8601. */
  readonly at: string;
}

/**
 * Registra o quadro novo como um passo do desfazer. Devolve o mesmo histórico quando nada mudou ou quando a mudança
 * mexe numa coluna bloqueada.
 */
export function applyChange(params: ApplyChangeParams): History<Board> {
  const { history, next, key, log, at } = params;
  const current = history.present;

  if (next === current || sameContent(next, current)) {
    return history;
  }
  // NOTE: a coluna bloqueada barra qualquer comando que mude os cards dela, venha de onde vier.
  if (!respectsLocks({ before: current.lanes, after: next.lanes })) {
    return history;
  }

  const coalescing = isCoalescing({ history, key });
  const stepStart = history.past.at(-1);
  // NOTE: um passo agrupado que volta ao começo (o Esc de um movimento pelo teclado) some do desfazer.
  if (coalescing && stepStart && sameContent(next, stepStart)) {
    return dropCoalesced(history);
  }

  const recorded = log
    ? withActivity({ before: current, after: next, at, merge: coalescing })
    : next;
  return recordChange({ history, next: recorded, key });
}
