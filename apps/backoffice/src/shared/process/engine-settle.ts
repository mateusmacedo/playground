import {
  depart,
  endPath,
  type Flow,
  record,
  rest,
  withoutTokens,
} from './engine-flow';
import { joinToFire } from './engine-joins';
import { choicesOf, isJoin, resolutionOf } from './engine-kinds';
import { innerStart, locate, type Place } from './engine-places';
import {
  accepted,
  ENDLESS_LOOP,
  type RunResult,
  refused,
} from './engine-result';
import { isWithin } from './plan';
import {
  appendLog,
  type ProcessRun,
  type RunEvent,
  type RunOutcome,
  type RunToken,
} from './run';

/** Máximo de passos automáticos num avanço; passar disso indica um laço sem etapa que espere uma ação. */
export const AUTOMATIC_STEP_LIMIT = 1000;

/** Desfecho do Fim que não declara um. */
const DEFAULT_OUTCOME: RunOutcome = {
  kind: 'completed',
  label: 'Concluído',
};

const FINISHED_LABEL = 'Processo concluído';
const SUBPROCESS_DONE_TEXT = 'Subprocesso concluído';

interface StopParams {
  readonly flow: Flow;
  readonly place: Place;
}

/** Atravessa a etapa automática: a abertura paralela segue por todas as saídas; as demais, pela primeira. */
function passThrough(params: StopParams): Flow {
  const { flow, place } = params;
  const { exits, kind } = place.step;
  const ways = kind === 'parallel-split' ? exits : exits.slice(0, 1);
  if (ways.length === 0) {
    return depart({ flow, place });
  }
  let next = flow;
  for (const way of ways) {
    next = depart({ flow: next, place, way });
  }
  return next;
}

/** Trata a chegada de uma ficha à etapa: o caminho termina, a ficha para ali ou segue adiante sozinha. */
function arrive(params: StopParams): Flow {
  const { flow, place } = params;
  const { step } = place;
  if (step.kind === 'end') {
    const outcome = step.outcome ?? DEFAULT_OUTCOME;
    return endPath({ flow, place, outcome });
  }
  const entry = innerStart(place);
  if (entry !== undefined) {
    const entered = rest({ flow, place, mark: { scope: true } });
    return { ...entered, arrivals: [...entered.arrivals, entry] };
  }
  if (isJoin(step)) {
    return rest({ flow, place, mark: { waiting: true } });
  }
  const resolution = resolutionOf(step);
  // WHY: escolha sem nenhuma saída para escolher prenderia a ficha para sempre; o caminho termina ali.
  if (resolution === 'choose' && choicesOf(step).length === 0) {
    return depart({ flow, place });
  }
  if (resolution !== undefined) {
    return rest({ flow, place });
  }
  return passThrough({ flow, place });
}

interface FinishedScope {
  readonly token: RunToken;
  readonly place: Place;
}

/** Subprocesso em andamento que ficou sem ficha interna: a ficha de escopo dele já pode seguir. */
function finishedScope(flow: Flow): FinishedScope | undefined {
  for (const token of flow.tokens) {
    if (!token.scope) {
      continue;
    }
    const busy = flow.tokens.some((other) =>
      isWithin({ stepRef: other.stepRef, scope: token.stepRef }),
    );
    if (busy) {
      continue;
    }
    // NOTE: ficha de escopo fora do roteiro fica onde está; não há saída por onde levá-la.
    const place = locate({ plan: flow.plan, stepRef: token.stepRef });
    if (place !== undefined) {
      return { token, place };
    }
  }
  return undefined;
}

interface LeaveScopeParams {
  readonly flow: Flow;
  readonly scope: FinishedScope;
}

function leaveScope(params: LeaveScopeParams): Flow {
  const { flow, scope } = params;
  const { token, place } = scope;
  const freed = withoutTokens({ flow, gone: (item) => item.id === token.id });
  const logged = record({
    flow: freed,
    event: {
      at: flow.at,
      kind: 'step',
      stepRef: place.stepRef,
      label: place.step.label,
      detail: SUBPROCESS_DONE_TEXT,
    },
  });
  return depart({ flow: logged, place, way: place.step.exits.at(0) });
}

interface FireJoinParams {
  readonly flow: Flow;
  readonly join: Place;
}

/** Dispara a junção: as fichas em espera viram uma só, que segue pela saída. */
function fireJoin(params: FireJoinParams): Flow {
  const { flow, join } = params;
  const merged = withoutTokens({
    flow,
    gone: (token) => token.stepRef === join.stepRef,
  });
  return depart({ flow: merged, place: join, way: join.step.exits.at(0) });
}

/**
 * Um passo automático: trata a próxima chegada ou, com todas as fichas paradas, encerra um subprocesso sem ficha
 * interna ou dispara uma junção. `undefined` quando não há mais nada a mover.
 */
function advanceOnce(flow: Flow): Flow | undefined {
  const [place, ...arrivals] = flow.arrivals;
  if (place !== undefined) {
    return arrive({ flow: { ...flow, arrivals }, place });
  }
  const scope = finishedScope(flow);
  if (scope !== undefined) {
    return leaveScope({ flow, scope });
  }
  const join = joinToFire({ plan: flow.plan, tokens: flow.tokens });
  if (join !== undefined) {
    return fireJoin({ flow, join });
  }
  return undefined;
}

/**
 * Atravessa os passos automáticos até toda ficha estar parada numa etapa que espera uma ação, uma junção ou um
 * subprocesso. `undefined` quando o limite de passos acaba antes disso.
 */
function settle(flow: Flow): Flow | undefined {
  let current = flow;
  for (let passes = 0; passes <= AUTOMATIC_STEP_LIMIT; passes += 1) {
    const next = advanceOnce(current);
    if (next === undefined) {
      return current;
    }
    current = next;
  }
  return undefined;
}

export interface ConcludeParams {
  /** Execução antes do avanço. */
  readonly run: ProcessRun;
  readonly flow: Flow;
}

/** Execução depois do avanço; sem fichas, ela termina com o desfecho do último caminho encerrado. */
function closeFlow(params: ConcludeParams): ProcessRun {
  const { run, flow } = params;
  const moved: ProcessRun = {
    ...run,
    tokens: flow.tokens,
    nextToken: flow.nextToken,
    takenExits: flow.takenExits,
  };
  if (flow.tokens.length > 0) {
    return { ...moved, log: appendLog({ log: run.log, events: flow.events }) };
  }
  const finished: RunEvent = {
    at: flow.at,
    kind: 'finished',
    label: FINISHED_LABEL,
    detail: flow.outcome.label,
  };
  return {
    ...moved,
    status: 'completed',
    endedAt: flow.at,
    outcome: flow.outcome,
    log: appendLog({ log: run.log, events: [...flow.events, finished] }),
  };
}

/** Fecha o avanço: atravessa os passos automáticos e devolve a execução nova, ou a recusa do laço sem fim. */
export function conclude(params: ConcludeParams): RunResult {
  const { run, flow } = params;
  const settled = settle(flow);
  if (settled === undefined) {
    return refused(ENDLESS_LOOP);
  }
  return accepted(closeFlow({ run, flow: settled }));
}
