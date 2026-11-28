import type { RunViewParams } from './engine-active';
import { resolutionOf, tokenState } from './engine-kinds';
import { allPlaces, innerStart, locate, type Place } from './engine-places';
import { reachableFrom } from './engine-reach';
import { resolvedRefs } from './engine-states';
import type { StepRef } from './plan';

/** Andamento da execução em etapas acionáveis: as que esperam uma ação de alguém. */
export interface RunProgress {
  /** Etapas distintas já resolvidas ao menos uma vez. */
  readonly done: number;
  /** Etapas distintas que as fichas ainda podem encontrar, contando as atuais. */
  readonly remaining: number;
  readonly total: number;
}

/**
 * Etapas acionáveis que uma ficha encontra ao chegar a `place`: a própria etapa ou, no subprocesso em que dá para
 * entrar, as que o processo interno alcança a partir do início dele.
 */
function actionableAt(place: Place): readonly StepRef[] {
  const entry = innerStart(place);
  if (entry === undefined) {
    return resolutionOf(place.step) === undefined ? [] : [place.stepRef];
  }
  const refs: StepRef[] = [];
  for (const inner of [entry, ...reachableFrom(entry)]) {
    refs.push(...actionableAt(inner));
  }
  return refs;
}

/** Etapas acionáveis ainda pela frente: as das fichas pendentes e as que cada ficha consegue alcançar. */
function remainingRefs(params: RunViewParams): ReadonlySet<StepRef> {
  const { plan, run } = params;
  const refs = new Set<StepRef>();
  for (const token of run.tokens) {
    const place = locate({ plan, stepRef: token.stepRef });
    if (place === undefined) {
      continue;
    }
    const current = tokenState(token) === 'pending' ? actionableAt(place) : [];
    const ahead = reachableFrom(place).flatMap((next) => actionableAt(next));
    for (const stepRef of [...current, ...ahead]) {
      refs.add(stepRef);
    }
  }
  return refs;
}

function countDone(params: RunViewParams): number {
  const resolved = resolvedRefs(params);
  const done = allPlaces(params.plan).filter(
    (place) =>
      resolved.has(place.stepRef) && resolutionOf(place.step) !== undefined,
  );
  return done.length;
}

/**
 * Andamento da execução. Num laço, a etapa já resolvida a que a execução pode voltar conta como feita e como
 * restante, e por isso o total cresce. Execução encerrada não tem etapa restante.
 */
export function runProgress(params: RunViewParams): RunProgress {
  const done = countDone(params);
  const remaining =
    params.run.status === 'running' ? remainingRefs(params).size : 0;
  return { done, remaining, total: done + remaining };
}
