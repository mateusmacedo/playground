import { advance } from '@/shared/process/engine';
import { activeSteps } from '@/shared/process/engine-active';
import type { ProcessRun } from '@/shared/process/run';

import {
  allCards,
  type Board,
  type BoardCard,
  type CardStepLink,
  findCard,
  updateCardIn,
} from './board';
import { planFor, sameRun } from './board-processes';
import { doneLaneOf, movedIntoDone, moveToDone } from './done-lane';
import { syncStepLinks } from './step-links';

/** Rodadas de reação por mudança; uma reação pode disparar outra, e o limite corta o que não estabilizar. */
export const SETTLE_LIMIT = 50;

/** Uma rodada: o quadro de antes da última leva de mudanças, o de agora e o instante da mudança (ISO 8601). */
interface Round {
  readonly previous: Board;
  readonly current: Board;
  readonly at: string;
}

interface StepCompletion {
  readonly board: Board;
  /** Card filho que chegou à coluna de conclusão. */
  readonly child: BoardCard;
  readonly link: CardStepLink;
  readonly at: string;
}

/**
 * A execução do dono com a etapa do filho concluída. `undefined` quando a etapa fica à espera de alguém: ela pede uma
 * escolha, tem campo obrigatório ou já não está entregue ao filho.
 */
function completedRun(params: StepCompletion): ProcessRun | undefined {
  const { board, child, link, at } = params;
  const run = findCard({ lanes: board.lanes, cardId: link.cardId })?.card
    .process;
  if (!run) {
    return undefined;
  }
  const plan = planFor({ board, run });
  if (!plan) {
    return undefined;
  }
  const active = activeSteps({ plan, run }).find(
    (candidate) => candidate.token.id === link.tokenId,
  );
  if (
    active?.token.delegateId !== child.id ||
    active.resolution !== 'complete' ||
    active.step.fields?.some((field) => field.required)
  ) {
    return undefined;
  }
  const result = advance({
    plan,
    run,
    action: {
      kind: 'complete',
      tokenId: link.tokenId,
      note: `Concluída pelo card filho ${child.title}.`,
    },
    at,
  });
  return result.ok ? result.run : undefined;
}

/** Reação 1: o card filho que chegou à coluna de conclusão conclui a etapa que ele executa. */
function completeDelegatedSteps(round: Round): Board {
  const { previous, at } = round;
  let board = round.current;
  for (const child of movedIntoDone({ before: previous, after: board })) {
    const link = child.stepOf;
    if (!link) {
      continue;
    }
    const process = completedRun({ board, child, link, at });
    if (!process) {
      continue;
    }
    const lanes = updateCardIn({
      lanes: board.lanes,
      cardId: link.cardId,
      update: (owner) => ({ ...owner, process }),
    });
    board = { ...board, lanes };
  }
  return board;
}

interface CardInRound {
  readonly round: Round;
  readonly card: BoardCard;
}

/** Diz se a execução do card foi concluída nesta rodada; o card que não estava nas colunas antes não conta. */
function justCompleted(params: CardInRound): boolean {
  const { round, card } = params;
  if (card.process?.status !== 'completed') {
    return false;
  }
  const before = findCard({ lanes: round.previous.lanes, cardId: card.id });
  if (!before) {
    return false;
  }
  const earlier = before.card.process;
  const wasCompleted =
    earlier?.status === 'completed' && sameRun(earlier, card.process);
  return !wasCompleted;
}

/** Reação 2: a execução que acabou de ser concluída leva o card para a coluna de conclusão. */
function followEndedProcesses(round: Round): Board {
  let board = round.current;
  for (const card of allCards(board.lanes)) {
    if (justCompleted({ round, card })) {
      board = moveToDone({ board, cardId: card.id });
    }
  }
  return board;
}

interface ChildrenCheck {
  readonly board: Board;
  readonly parentId: string;
}

/** Diz se todos os filhos diretos do card estão na coluna de conclusão. */
function allChildrenDone(params: ChildrenCheck): boolean {
  const { board, parentId } = params;
  const done = doneLaneOf(board);
  const concluded = new Set(done?.cards.map((card) => card.id));
  const children = allCards(board.lanes).filter(
    (card) => card.parentId === parentId,
  );
  return children.every((child) => concluded.has(child.id));
}

/** Reação 3: a última filha direta que chegou à coluna de conclusão leva o pai junto. */
function followDoneChildren(round: Round): Board {
  let board = round.current;
  for (const child of movedIntoDone({ before: round.previous, after: board })) {
    const { parentId } = child;
    if (parentId !== undefined && allChildrenDone({ board, parentId })) {
      board = moveToDone({ board, cardId: parentId });
    }
  }
  return board;
}

/** As três reações, uma vez, cada uma já vendo o que a anterior fez; depois, as ligações de etapa acertadas. */
function react(round: Round): Board {
  const rules = round.current.config.rules ?? {};
  let board = completeDelegatedSteps(round);
  if (rules.processEndMovesCard) {
    board = followEndedProcesses({ ...round, current: board });
  }
  if (rules.parentFollowsChildren) {
    board = followDoneChildren({ ...round, current: board });
  }
  return syncStepLinks(board);
}

export interface SettleBoardParams {
  /** O quadro de antes da mudança. */
  readonly before: Board;
  /** O quadro com a mudança pedida. */
  readonly after: Board;
  /** Data e hora da mudança, ISO 8601. */
  readonly at: string;
}

/**
 * Aplica ao quadro mudado o que a mudança provoca, para tudo valer como um passo só do desfazer: o card filho que
 * chegou à coluna de conclusão conclui a etapa que executa; com as regras ligadas, o processo concluído e a última
 * filha concluída levam o card para a coluna de conclusão. Repete até nada mais mudar, porque uma reação pode
 * disparar outra. Sem nada a fazer, devolve o próprio `after`.
 */
export function settleBoard(params: SettleBoardParams): Board {
  const { at } = params;
  let previous = params.before;
  let current = params.after;
  for (let round = 0; round < SETTLE_LIMIT; round += 1) {
    const next = react({ previous, current, at });
    if (next === current) {
      return current;
    }
    previous = current;
    current = next;
  }
  return current;
}
