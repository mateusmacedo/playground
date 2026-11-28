import { advance } from '@/shared/process/engine';
import type { ProcessRun, RunToken } from '@/shared/process/run';

import { allCards, type Board, type BoardCard } from './board';
import { planFor } from './board-processes';
import { mapCards } from './map-cards';

/** Os cards que estão nas colunas, pelo id. */
type LiveCards = ReadonlyMap<string, BoardCard>;

function liveCards(board: Board): LiveCards {
  const cards = new Map<string, BoardCard>();
  for (const card of allCards(board.lanes)) {
    cards.set(card.id, card);
  }
  return cards;
}

interface CardCheck {
  readonly card: BoardCard;
  readonly cards: LiveCards;
}

/** Diz se o card ainda executa a etapa: o dono está no quadro, com a execução em andamento e a ficha entregue a ele. */
function holdsStep(params: CardCheck): boolean {
  const { card, cards } = params;
  const link = card.stepOf;
  if (!link) {
    return false;
  }
  const run = cards.get(link.cardId)?.process;
  if (run?.status !== 'running') {
    return false;
  }
  return run.tokens.some(
    (token) => token.id === link.tokenId && token.delegateId === card.id,
  );
}

interface TokenCheck extends CardCheck {
  readonly token: RunToken;
}

/** Diz se a ficha foi entregue a um card que saiu do quadro ou que já não aponta para ela. */
function isOrphan(params: TokenCheck): boolean {
  const { card, cards, token } = params;
  if (token.delegateId === undefined) {
    return false;
  }
  const link = cards.get(token.delegateId)?.stepOf;
  return link?.cardId !== card.id || link.tokenId !== token.id;
}

interface RunCheck extends CardCheck {
  readonly board: Board;
}

/** A execução do card sem as delegações órfãs; sem nenhuma, a própria execução. */
function withoutOrphans(params: RunCheck): ProcessRun | undefined {
  const { board, card, cards } = params;
  const run = card.process;
  if (run?.status !== 'running') {
    return run;
  }
  const plan = planFor({ board, run });
  if (!plan) {
    return run;
  }
  let current = run;
  for (const token of run.tokens) {
    if (!isOrphan({ card, cards, token })) {
      continue;
    }
    const result = advance({
      plan,
      run: current,
      action: { kind: 'undelegate', tokenId: token.id },
      // NOTE: desfazer a delegação não gera registro; o instante vai porque o motor o pede em toda ação.
      at: token.since,
    });
    if (result.ok) {
      current = result.run;
    }
  }
  return current;
}

function syncedCard(params: RunCheck): BoardCard {
  const { card } = params;
  const stepOf = holdsStep(params) ? card.stepOf : undefined;
  const process = withoutOrphans(params);
  if (stepOf === card.stepOf && process === card.process) {
    return card;
  }
  return { ...card, stepOf, process };
}

/**
 * Acerta as duas pontas da ligação entre a etapa de um processo e o card filho que a executa. A ligação só vale com
 * os dois cards nas colunas, a execução em andamento e a ficha ainda parada na etapa: fora disso, o filho deixa de
 * apontar para a etapa e a ficha volta a ficar sem executor. Sem nada a acertar, devolve o próprio `board`.
 */
export function syncStepLinks(board: Board): Board {
  const cards = liveCards(board);
  const lanes = mapCards({
    lanes: board.lanes,
    update: (card) => syncedCard({ board, card, cards }),
  });
  return lanes === board.lanes ? board : { ...board, lanes };
}
