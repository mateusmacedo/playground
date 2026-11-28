import { withActivity } from './activity';
import type { Board, BoardLane } from './board';
import { pruneProcesses } from './board-processes';
import { pruneBlockers } from './dependencies';
import { doneRefusal } from './done-guard';
import {
  dropCoalesced,
  type History,
  isCoalescing,
  recordChange,
} from './history';
import { respectsLocks } from './lane-state';
import { settleBoard } from './reactions';

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
    a.config === b.config &&
    a.processes === b.processes
  );
}

export interface ChangeCheckParams {
  readonly history: History<Board>;
  /** O quadro depois da mudança. */
  readonly next: Board;
  /** Mudanças seguidas com a mesma chave entram no mesmo passo do desfazer. */
  readonly key?: string;
}

/** Diz se a mudança não tem como valer: nada mudou, ou ela mexe numa coluna bloqueada. */
function isIdle(params: ChangeCheckParams): boolean {
  const { history, next } = params;
  const current = history.present;
  if (next === current || sameContent(next, current)) {
    return true;
  }
  // NOTE: a coluna bloqueada barra qualquer comando que mude os cards dela, venha de onde vier.
  return !respectsLocks({ before: current.lanes, after: next.lanes });
}

/** Diz se a mudança volta o quadro ao começo do passo agrupado em andamento (o Esc de um movimento pelo teclado). */
function returnsToStepStart(params: ChangeCheckParams): boolean {
  const { history, next, key } = params;
  const stepStart = history.past.at(-1);
  return (
    isCoalescing({ history, key }) &&
    stepStart !== undefined &&
    sameContent(next, stepStart)
  );
}

/**
 * Motivo, em uma frase para a tela, pelo qual as regras do quadro recusam a mudança. `undefined` quando ela pode
 * seguir e quando o que a barra é outra coisa: nada mudou, ou a coluna está bloqueada, que tem aviso próprio.
 */
export function changeRefusal(params: ChangeCheckParams): string | undefined {
  // WHY: voltar ao começo do passo é desistir da mudança, e desistir nunca é recusado.
  if (isIdle(params) || returnsToStepStart(params)) {
    return undefined;
  }
  return doneRefusal({ before: params.history.present, after: params.next });
}

export interface ApplyChangeParams extends ChangeCheckParams {
  /** Registra a mudança no histórico dos cards. */
  readonly log: boolean;
  /** Data e hora da mudança, ISO 8601. */
  readonly at: string;
  /**
   * Passa a mudança pelas regras do quadro: a guarda da coluna de conclusão e o que a mudança provoca. Só a troca do
   * quadro inteiro (restaurar o exemplo) dispensa; ausente, vale ligado.
   */
  readonly rules?: boolean;
}

/**
 * Registra o quadro novo como um passo do desfazer, já com o que a mudança provoca (etapa concluída pelo card filho,
 * card levado à coluna de conclusão), sem os bloqueadores que saíram das colunas e sem os roteiros que ficaram sem
 * uso. Devolve o mesmo histórico quando nada
 * mudou, quando a mudança mexe numa coluna bloqueada e quando as regras do quadro a recusam.
 */
export function applyChange(params: ApplyChangeParams): History<Board> {
  const { history, key, log, at } = params;
  const current = history.present;
  const ruled = params.rules ?? true;

  if (isIdle(params)) {
    return history;
  }
  // NOTE: um passo agrupado que volta ao começo (o Esc de um movimento pelo teclado) some do desfazer.
  if (returnsToStepStart(params)) {
    return dropCoalesced(history);
  }
  const refusal = ruled
    ? doneRefusal({ before: current, after: params.next })
    : undefined;
  if (refusal !== undefined) {
    return history;
  }

  const settled = ruled
    ? settleBoard({ before: current, after: params.next, at })
    : params.next;
  const next = pruneProcesses(pruneBlockers(settled));
  const recorded = log
    ? withActivity({
        before: current,
        after: next,
        at,
        merge: isCoalescing({ history, key }),
      })
    : next;
  return recordChange({ history, next: recorded, key });
}
