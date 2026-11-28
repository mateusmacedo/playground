import type { RunViewParams } from './engine-active';
import { waysOf } from './engine-kinds';
import { allPlaces, innerStart, type Place } from './engine-places';
import {
  type ExitKey,
  exitKey,
  type ProcessPlan,
  type StepRef,
  stepRefOf,
} from './plan';

/** Estado de uma etapa no diagrama: com ficha ativa, com ficha em espera numa junção ou já concluída. */
export type StepState = 'active' | 'waiting' | 'done';

export interface StepStates {
  /** Estado de cada etapa por onde a execução passou; etapa sem estado ainda não foi alcançada. */
  readonly states: ReadonlyMap<StepRef, StepState>;
  /** Saídas e exceções já percorridas, para destacar as conexões do diagrama. */
  readonly takenExits: ReadonlySet<ExitKey>;
}

interface TakenParams {
  readonly place: Place;
  readonly taken: ReadonlySet<ExitKey>;
}

/** Diz se a execução já saiu da etapa: por uma saída ou por uma exceção que a interrompeu. */
function wasLeft(params: TakenParams): boolean {
  const { place, taken } = params;
  const { stepRef, step } = place;
  const byExit = step.exits.some((exit) =>
    taken.has(exitKey({ stepRef, exitId: exit.id })),
  );
  if (byExit) {
    return true;
  }
  const events = step.events ?? [];
  return events.some(
    (event) =>
      event.interrupting && taken.has(exitKey({ stepRef, exitId: event.id })),
  );
}

/** Endereços das etapas a que os caminhos percorridos a partir de `place` chegaram. */
function arrivalsFrom(params: TakenParams): readonly StepRef[] {
  const { place, taken } = params;
  const refs: StepRef[] = [];
  for (const way of waysOf(place.step)) {
    const key = exitKey({ stepRef: place.stepRef, exitId: way.id });
    if (way.to !== undefined && taken.has(key)) {
      refs.push(stepRefOf({ scope: place.scope, id: way.to }));
    }
  }
  return refs;
}

interface ReachedParams {
  readonly plan: ProcessPlan;
  readonly places: readonly Place[];
  readonly taken: ReadonlySet<ExitKey>;
}

/**
 * Endereços das etapas a que a execução chegou: o início do processo, o destino de cada caminho percorrido e o
 * início do processo interno de cada subprocesso alcançado.
 */
function reachedRefs(params: ReachedParams): ReadonlySet<StepRef> {
  const { plan, places, taken } = params;
  const reached = new Set<StepRef>([plan.startId]);
  for (const place of places) {
    for (const stepRef of arrivalsFrom({ place, taken })) {
      reached.add(stepRef);
    }
  }
  // NOTE: `places` traz cada subprocesso antes das etapas internas dele; uma passada basta para todos os níveis.
  for (const place of places) {
    const entry = innerStart(place);
    if (entry !== undefined && reached.has(place.stepRef)) {
      reached.add(entry.stepRef);
    }
  }
  return reached;
}

/**
 * Endereços das etapas já resolvidas: aquelas de onde a execução saiu ao menos uma vez. A etapa sem saída, como o
 * Fim, conta quando a execução chegou a ela e não há ficha parada ali.
 */
export function resolvedRefs(params: RunViewParams): ReadonlySet<StepRef> {
  const { plan, run } = params;
  const taken = new Set(run.takenExits);
  const places = allPlaces(plan);
  const reached = reachedRefs({ plan, places, taken });
  const occupied = new Set(run.tokens.map((token) => token.stepRef));
  const resolved = new Set<StepRef>();
  for (const place of places) {
    const { stepRef, step } = place;
    const ended =
      step.exits.length === 0 && reached.has(stepRef) && !occupied.has(stepRef);
    if (ended || wasLeft({ place, taken })) {
      resolved.add(stepRef);
    }
  }
  return resolved;
}

/**
 * Estados das etapas para o diagrama da execução. A ficha manda: a etapa já resolvida a que um laço voltou aparece
 * como ativa. O subprocesso em andamento aparece como ativo.
 */
export function stepStates(params: RunViewParams): StepStates {
  const { run } = params;
  const states = new Map<StepRef, StepState>();
  for (const stepRef of resolvedRefs(params)) {
    states.set(stepRef, 'done');
  }
  for (const token of run.tokens) {
    states.set(token.stepRef, token.waiting ? 'waiting' : 'active');
  }
  return { states, takenExits: new Set(run.takenExits) };
}
