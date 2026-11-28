import { innerPlanOf } from './engine-kinds';
import {
  type PlanStep,
  type ProcessPlan,
  planAt,
  STEP_REF_SEPARATOR,
  type StepRef,
  scopeOf,
  stepRefOf,
} from './plan';

/** Uma etapa localizada no roteiro: o endereço, a etapa e o nível a que ela pertence. */
export interface Place {
  readonly stepRef: StepRef;
  readonly step: PlanStep;
  /** Roteiro do nível da etapa: o do processo ou o processo interno de um subprocesso. */
  readonly level: ProcessPlan;
  /** Endereço do subprocesso que contém a etapa; sem ele, a etapa é da raiz. */
  readonly scope?: StepRef;
}

/** Id da etapa dentro do nível dela: o último trecho do endereço. */
export function stepIdOf(stepRef: StepRef): string {
  const cut = stepRef.lastIndexOf(STEP_REF_SEPARATOR);
  return stepRef.slice(cut + 1);
}

export interface PlaceInParams {
  readonly level: ProcessPlan;
  /** Endereço do subprocesso dono do nível; sem ele, o nível é a raiz. */
  readonly scope?: StepRef;
  /** Id da etapa no nível; sem id, não há etapa a localizar. */
  readonly id: string | undefined;
}

/** A etapa `id` do nível; `undefined` quando o nível não tem essa etapa. */
export function placeIn(params: PlaceInParams): Place | undefined {
  const { level, scope, id } = params;
  const step = level.steps.find((item) => item.id === id);
  if (step === undefined) {
    return undefined;
  }
  return { stepRef: stepRefOf({ scope, id: step.id }), step, level, scope };
}

export interface LocateParams {
  readonly plan: ProcessPlan;
  readonly stepRef: StepRef;
}

/** Localiza a etapa do endereço; `undefined` quando o endereço não leva a uma etapa do roteiro. */
export function locate(params: LocateParams): Place | undefined {
  const { plan, stepRef } = params;
  const scope = scopeOf(stepRef);
  const level = planAt({ plan, scope });
  if (level === undefined) {
    return undefined;
  }
  return placeIn({ level, scope, id: stepIdOf(stepRef) });
}

/** Início do processo interno do subprocesso; `undefined` quando não dá para entrar na etapa. */
export function innerStart(place: Place): Place | undefined {
  const inner = innerPlanOf(place.step);
  if (inner === undefined) {
    return undefined;
  }
  return placeIn({ level: inner, scope: place.stepRef, id: inner.startId });
}

interface LevelParams {
  readonly level: ProcessPlan;
  readonly scope?: StepRef;
}

function placesIn(params: LevelParams): Place[] {
  const { level, scope } = params;
  const places: Place[] = [];
  for (const step of level.steps) {
    const stepRef = stepRefOf({ scope, id: step.id });
    places.push({ stepRef, step, level, scope });
    const inner = innerPlanOf(step);
    if (inner !== undefined) {
      places.push(...placesIn({ level: inner, scope: stepRef }));
    }
  }
  return places;
}

/** Todas as etapas do roteiro, com as dos processos internos em que a execução consegue entrar. */
export function allPlaces(plan: ProcessPlan): readonly Place[] {
  return placesIn({ level: plan });
}
