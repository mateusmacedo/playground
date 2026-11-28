import type { BoardPair } from './activity-changes';
import {
  allCards,
  type Board,
  type BoardCard,
  type BoardLane,
  type BoardRules,
} from './board';
import { doneLaneOf, enteredDone } from './done-lane';

/** O card que entrou na coluna de conclusão, com o quadro e a coluna de depois da mudança. */
interface Entry {
  readonly board: Board;
  readonly done: BoardLane;
  readonly card: BoardCard;
}

/** Cards que estão no quadro, fora da coluna de conclusão. */
function pendingCards(entry: Entry): readonly BoardCard[] {
  const concluded = new Set(entry.done.cards.map((card) => card.id));
  return allCards(entry.board.lanes).filter((card) => !concluded.has(card.id));
}

function processRefusal(entry: Entry): string | undefined {
  const { card, done } = entry;
  if (card.process?.status !== 'running') {
    return undefined;
  }
  return `O card ${card.title} tem o processo ${card.process.name} em andamento: conclua ou cancele o processo antes de levar o card para ${done.title}.`;
}

function childrenRefusal(entry: Entry): string | undefined {
  const { card, done } = entry;
  const pending = pendingCards(entry).filter(
    (candidate) => candidate.parentId === card.id,
  );
  if (pending.length === 0) {
    return undefined;
  }
  const children =
    pending.length === 1 ? '1 filho' : `${pending.length} filhos`;
  return `O card ${card.title} tem ${children} fora de ${done.title}: conclua os filhos antes de levar o card para lá.`;
}

function blockersRefusal(entry: Entry): string | undefined {
  const { card, done } = entry;
  const blockerIds = new Set(card.blockedBy);
  const pending = pendingCards(entry).filter((candidate) =>
    blockerIds.has(candidate.id),
  );
  if (pending.length === 0) {
    return undefined;
  }
  const titles = pending.map((blocker) => blocker.title).join(', ');
  return `O card ${card.title} está bloqueado por ${titles}: conclua o que o bloqueia antes de levar o card para ${done.title}.`;
}

interface RuledEntry extends Entry {
  readonly rules: BoardRules;
}

/** Motivo que impede o card de entrar na coluna de conclusão, pelas regras ligadas no quadro; o primeiro que houver. */
function entryRefusal(params: RuledEntry): string | undefined {
  const { rules } = params;
  const process = rules.doneWaitsProcess ? processRefusal(params) : undefined;
  const children = rules.parentWaitsChildren
    ? childrenRefusal(params)
    : undefined;
  const blockers = rules.doneWaitsBlockers
    ? blockersRefusal(params)
    : undefined;
  return process ?? children ?? blockers;
}

/**
 * Motivo, em uma frase para a tela, que faz o quadro recusar a mudança: algum card entrou na coluna de conclusão com
 * processo em andamento, com filho fora dela ou com bloqueador pendente, e a regra correspondente está ligada.
 * `undefined` quando a mudança pode seguir.
 */
export function doneRefusal(pair: BoardPair): string | undefined {
  const board = pair.after;
  const done = doneLaneOf(board);
  const { rules } = board.config;
  if (!done || !rules) {
    return undefined;
  }
  for (const card of enteredDone(pair)) {
    const refusal = entryRefusal({ board, done, card, rules });
    if (refusal) {
      return refusal;
    }
  }
  return undefined;
}
