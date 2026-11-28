import { waysOf } from './engine-kinds';
import { type Place, placeIn } from './engine-places';
import type { StepRef } from './plan';

/**
 * Etapas do mesmo nível que uma ficha em `place` ainda consegue alcançar, seguindo as saídas e as exceções presas a
 * cada etapa do caminho. A etapa de partida só entra quando um laço volta a ela.
 */
export function reachableFrom(place: Place): readonly Place[] {
  const { level, scope } = place;
  const reached = new Map<string, Place>();
  const pending: Place[] = [place];
  for (
    let current = pending.pop();
    current !== undefined;
    current = pending.pop()
  ) {
    for (const way of waysOf(current.step)) {
      const target = placeIn({ level, scope, id: way.to });
      if (target !== undefined && !reached.has(target.step.id)) {
        reached.set(target.step.id, target);
        pending.push(target);
      }
    }
  }
  return [...reached.values()];
}

export interface CanReachParams {
  /** Onde a ficha está. */
  readonly from: Place;
  /** Endereço da etapa de destino, no mesmo nível. */
  readonly to: StepRef;
}

/** Diz se uma ficha em `from` ainda consegue chegar à etapa `to`. */
export function canReach(params: CanReachParams): boolean {
  const { from, to } = params;
  return reachableFrom(from).some((place) => place.stepRef === to);
}
