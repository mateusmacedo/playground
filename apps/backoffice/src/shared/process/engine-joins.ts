import { locate, type Place } from './engine-places';
import { canReach } from './engine-reach';
import type { ProcessPlan, StepRef } from './plan';
import type { RunToken } from './run';

export interface JoinParams {
  readonly plan: ProcessPlan;
  /** Fichas da execução, na ordem em que foram criadas. */
  readonly tokens: readonly RunToken[];
}

/** Endereços das junções com ficha em espera, da espera mais antiga para a mais nova. */
function waitingRefs(tokens: readonly RunToken[]): readonly StepRef[] {
  const refs = new Set<StepRef>();
  for (const token of tokens) {
    if (token.waiting) {
      refs.add(token.stepRef);
    }
  }
  return [...refs];
}

interface BlockersParams extends JoinParams {
  readonly join: Place;
}

/**
 * Fichas que ainda podem chegar à junção: as outras que a alcançam. O alcance fica no nível de cada ficha, então só
 * as do nível da junção contam; a ficha de escopo vale pelas de dentro do subprocesso, que só saem dele pela saída
 * ou pelas exceções do bloco.
 */
function blockersOf(params: BlockersParams): readonly RunToken[] {
  const { plan, tokens, join } = params;
  return tokens.filter((token) => {
    if (token.stepRef === join.stepRef) {
      return false;
    }
    const from = locate({ plan, stepRef: token.stepRef });
    return from !== undefined && canReach({ from, to: join.stepRef });
  });
}

/**
 * Junção que dispara agora, com todas as fichas paradas: a que tem ficha em espera e nenhuma outra ficha do nível
 * consegue alcançar. A regra vale para a sincronização paralela e para a junção inclusiva.
 */
export function joinToFire(params: JoinParams): Place | undefined {
  const { plan, tokens } = params;
  let stalled: Place | undefined;
  for (const stepRef of waitingRefs(tokens)) {
    const join = locate({ plan, stepRef });
    // NOTE: ficha em espera fora do roteiro fica onde está; não há saída por onde levá-la.
    if (join === undefined) {
      continue;
    }
    const blockers = blockersOf({ plan, tokens, join });
    if (blockers.length === 0) {
      return join;
    }
    const onlyWaiting = blockers.every((token) => token.waiting === true);
    if (stalled === undefined && onlyWaiting) {
      stalled = join;
    }
  }
  // WHY: junções que só esperam fichas paradas em outras junções esperariam umas pelas outras para sempre; sem
  // nenhuma que dispare pela regra, a de espera mais antiga dispara e desfaz o impasse.
  return stalled;
}
