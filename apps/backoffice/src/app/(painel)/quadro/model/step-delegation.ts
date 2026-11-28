import { advance } from '@/shared/process/engine';
import { activeSteps } from '@/shared/process/engine-active';

import { type Board, updateCardIn } from './board';
import { addCard } from './cards';
import { inheritedFromParent } from './child-inherit';
import { cardRunOf, type ProcessChange, refusedChange } from './process-run';

/** Título do card filho quando a etapa não tem nome. */
export const UNNAMED_STEP_TITLE = 'Etapa do processo';

export interface DelegateStepParams {
  readonly board: Board;
  /** Card dono do processo. */
  readonly cardId: string;
  /** Ficha parada na etapa que o card filho vai executar. */
  readonly tokenId: string;
  /** Id do card filho. */
  readonly newId: string;
  /** Instante da delegação, ISO 8601. */
  readonly at: string;
  readonly by?: string;
}

/**
 * Entrega a etapa a um card filho novo: ele nasce com o nome da etapa no fim da coluna do dono e fica ligado à ficha;
 * com a regra `childInherits`, herda o responsável e as etiquetas do dono.
 * Recusa a coluna bloqueada, que não recebe card, e o que o motor não aceita delegar.
 */
export function delegateStep(params: DelegateStepParams): ProcessChange {
  const { board, cardId, tokenId, newId, at, by } = params;
  const found = cardRunOf({ board, cardId });
  if (!found.ok) {
    return found;
  }
  const { lane, run, plan } = found;
  if (lane.locked) {
    return refusedChange(
      `A coluna ${lane.title} está bloqueada: libere a coluna para criar o card filho.`,
    );
  }
  const active = activeSteps({ plan, run }).find(
    (candidate) => candidate.token.id === tokenId,
  );
  const result = advance({
    plan,
    run,
    action: { kind: 'delegate', tokenId, delegateId: newId },
    at,
    by,
  });
  if (!result.ok) {
    return refusedChange(result.refusal.message);
  }
  const process = result.run;
  const created = addCard({
    lanes: board.lanes,
    laneId: lane.id,
    card: {
      id: newId,
      title: active?.step.label.trim() || UNNAMED_STEP_TITLE,
      parentId: cardId,
      number: board.nextNumber,
      ...inheritedFromParent({ board, parentId: cardId }),
    },
  });
  const linked = updateCardIn({
    lanes: created,
    cardId: newId,
    update: (child) => ({ ...child, stepOf: { cardId, tokenId } }),
  });
  const lanes = updateCardIn({
    lanes: linked,
    cardId,
    update: (owner) => ({ ...owner, process }),
  });
  return {
    ok: true,
    board: { ...board, lanes, nextNumber: board.nextNumber + 1 },
  };
}
