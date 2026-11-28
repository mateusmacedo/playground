import type { Way } from './engine-kinds';
import { type Place, placeIn } from './engine-places';
import { type ExitKey, exitKey, type ProcessPlan } from './plan';
import type { ProcessRun, RunEvent, RunOutcome, RunToken } from './run';

/** Desfecho do caminho que termina sem chegar a um Fim. */
const DEAD_END_OUTCOME: RunOutcome = {
  kind: 'other',
  label: 'Caminho sem continuação',
};

/**
 * Estado de trabalho de um avanço: a execução em construção e as fichas ainda em trânsito. Cada passo devolve um
 * estado novo; a execução recebida nunca muda.
 */
export interface Flow {
  readonly plan: ProcessPlan;
  /** Instante do avanço (ISO 8601), informado por quem chama. */
  readonly at: string;
  readonly tokens: readonly RunToken[];
  readonly nextToken: number;
  /** Entradas do log criadas neste avanço. */
  readonly events: readonly RunEvent[];
  readonly takenExits: readonly ExitKey[];
  /** Desfecho do último caminho da raiz encerrado neste avanço; vale quando a execução termina nele. */
  readonly outcome: RunOutcome;
  /** Etapas a que uma ficha acabou de chegar e que ainda não foram tratadas, na ordem de chegada. */
  readonly arrivals: readonly Place[];
}

export interface OpenFlowParams {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  readonly at: string;
}

export function openFlow(params: OpenFlowParams): Flow {
  const { plan, run, at } = params;
  return {
    plan,
    at,
    tokens: run.tokens,
    nextToken: run.nextToken,
    events: [],
    takenExits: run.takenExits,
    outcome: DEAD_END_OUTCOME,
    arrivals: [],
  };
}

export interface RecordParams {
  readonly flow: Flow;
  readonly event: RunEvent;
}

/** Acrescenta uma entrada ao log do avanço. */
export function record(params: RecordParams): Flow {
  const { flow, event } = params;
  return { ...flow, events: [...flow.events, event] };
}

export interface WithoutTokensParams {
  readonly flow: Flow;
  /** Diz se a ficha sai da execução. */
  readonly gone: (token: RunToken) => boolean;
}

export function withoutTokens(params: WithoutTokensParams): Flow {
  const { flow, gone } = params;
  return { ...flow, tokens: flow.tokens.filter((token) => !gone(token)) };
}

export interface RestParams {
  readonly flow: Flow;
  readonly place: Place;
  /** Marca da ficha que não espera uma ação: em espera numa junção ou de escopo. */
  readonly mark?: Pick<RunToken, 'waiting' | 'scope'>;
}

/**
 * Para uma ficha nova na etapa. A ficha ganha um id a cada parada, para que repetir uma ação sobre a parada anterior
 * seja recusado em vez de resolver a etapa seguinte.
 */
export function rest(params: RestParams): Flow {
  const { flow, place, mark } = params;
  const token: RunToken = {
    id: `token-${flow.nextToken}`,
    stepRef: place.stepRef,
    since: flow.at,
    ...mark,
  };
  return {
    ...flow,
    tokens: [...flow.tokens, token],
    nextToken: flow.nextToken + 1,
  };
}

export interface EndPathParams {
  readonly flow: Flow;
  /** Etapa em que o caminho termina. */
  readonly place: Place;
  readonly outcome: RunOutcome;
}

/** Encerra um caminho: registra o fim no log e, na raiz, guarda o desfecho como o último alcançado. */
export function endPath(params: EndPathParams): Flow {
  const { flow, place, outcome } = params;
  const ended = record({
    flow,
    event: {
      at: flow.at,
      kind: 'path-ended',
      stepRef: place.stepRef,
      label: place.step.label,
      detail: outcome.label,
    },
  });
  return place.scope === undefined ? { ...ended, outcome } : ended;
}

interface MarkExitParams {
  readonly flow: Flow;
  readonly key: ExitKey;
}

function markExit(params: MarkExitParams): Flow {
  const { flow, key } = params;
  if (flow.takenExits.includes(key)) {
    return flow;
  }
  return { ...flow, takenExits: [...flow.takenExits, key] };
}

export interface DepartParams {
  readonly flow: Flow;
  /** Etapa de onde a ficha sai. */
  readonly place: Place;
  /** Saída ou exceção por onde ela sai; sem caminho, a etapa não tem por onde seguir. */
  readonly way?: Way;
}

/**
 * Leva uma ficha da etapa pelo caminho: marca a saída como percorrida e põe a ficha a caminho do destino. Sem
 * caminho, ou sem destino no nível, o caminho termina ali, como um Fim de desfecho "outro".
 */
export function depart(params: DepartParams): Flow {
  const { flow, place, way } = params;
  if (way === undefined) {
    return endPath({ flow, place, outcome: DEAD_END_OUTCOME });
  }
  const key = exitKey({ stepRef: place.stepRef, exitId: way.id });
  const marked = markExit({ flow, key });
  const target = placeIn({
    level: place.level,
    scope: place.scope,
    id: way.to,
  });
  if (target === undefined) {
    return endPath({ flow: marked, place, outcome: DEAD_END_OUTCOME });
  }
  return { ...marked, arrivals: [...marked.arrivals, target] };
}
