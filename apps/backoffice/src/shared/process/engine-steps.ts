import { eventDueAt, isBeforeDue, stepDueAt } from './engine-due';
import { depart, openFlow, record, withoutTokens } from './engine-flow';
import {
  allowsManyChoices,
  choicesOf,
  eventName,
  exitName,
  resolutionOf,
  type StepResolution,
  tokenState,
  type Way,
} from './engine-kinds';
import type { Place } from './engine-places';
import {
  CHOICE_EXPECTED,
  INVALID_EXIT,
  NOT_ACTIONABLE,
  NOTE_REQUIRED,
  NOTHING_TO_CHOOSE,
  ONE_EXIT_ONLY,
  type Refusal,
  type RunResult,
  refused,
  SOME_EXIT_NEEDED,
  UNKNOWN_EVENT,
} from './engine-result';
import { conclude } from './engine-settle';
import {
  type FieldEntry,
  type FieldValues,
  type RefusedValues,
  validateValues,
} from './fields';
import { isWithin, type PlanStep, type ProcessPlan } from './plan';
import type { ProcessRun, RunEvent, RunEventKind, RunToken } from './run';

/** Conclui a etapa: tarefas, envio de mensagem, temporizador e subprocesso sem processo interno. */
export interface CompleteAction {
  readonly kind: 'complete';
  readonly tokenId: string;
  readonly note?: string;
  readonly values?: FieldValues;
}

/** Escolhe por onde seguir: decisão, espera por evento e aprovação (uma saída) ou decisão inclusiva (uma ou mais). */
export interface ChooseAction {
  readonly kind: 'choose';
  readonly tokenId: string;
  readonly exitIds: readonly string[];
  readonly note?: string;
  readonly values?: FieldValues;
}

/** Aciona uma exceção presa à etapa ativa ou ao subprocesso em andamento, pela ficha de escopo dele. */
export interface RaiseAction {
  readonly kind: 'raise';
  readonly tokenId: string;
  readonly eventId: string;
  readonly note?: string;
}

/** A ficha de uma ação e a etapa em que ela está, já localizadas, com o contexto do avanço. */
export interface StepTarget {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  readonly at: string;
  readonly by?: string;
  readonly token: RunToken;
  readonly place: Place;
}

/** Observação do motor para o que foi feito antes da hora marcada. */
const EARLY_TEXT = 'antes do previsto';

/** Texto opcional sem espaços nas pontas; vazio conta como ausente. */
export function cleanText(text: string | undefined): string | undefined {
  return text?.trim() || undefined;
}

interface StepEventParams {
  readonly target: StepTarget;
  readonly kind: RunEventKind;
  readonly detail?: string;
  readonly note?: string;
  readonly entries?: readonly FieldEntry[];
}

function stepEvent(params: StepEventParams): RunEvent {
  const { target, kind, detail, note, entries = [] } = params;
  return {
    at: target.at,
    kind,
    stepRef: target.place.stepRef,
    label: target.place.step.label,
    detail,
    note: cleanText(note),
    by: cleanText(target.by),
    values: entries.length > 0 ? entries : undefined,
  };
}

interface MoveParams {
  readonly target: StepTarget;
  /** Entrada do log que registra a ação. */
  readonly event: RunEvent;
  /** Caminhos por onde seguem as fichas; um caminho ausente encerra o caminho na etapa. */
  readonly ways: readonly (Way | undefined)[];
  /** Diz se a ficha sai da etapa; a exceção que não interrompe deixa a ficha onde está. */
  readonly consume: boolean;
}

function moveOn(params: MoveParams): RunResult {
  const { target, event, ways, consume } = params;
  const { plan, run, at, token, place } = target;
  const opened = openFlow({ plan, run, at });
  // NOTE: com a ficha de escopo saem também as fichas de dentro do subprocesso.
  const freed = withoutTokens({
    flow: opened,
    gone: (item) =>
      consume &&
      (item.id === token.id ||
        isWithin({ stepRef: item.stepRef, scope: token.stepRef })),
  });
  let flow = record({ flow: freed, event });
  for (const way of ways) {
    flow = depart({ flow, place, way });
  }
  return conclude({ run, flow });
}

interface ResolutionParams {
  readonly target: StepTarget;
  readonly expected: StepResolution;
}

function resolutionRefusal(params: ResolutionParams): Refusal | undefined {
  const { target, expected } = params;
  const resolution = resolutionOf(target.place.step);
  if (tokenState(target.token) !== 'pending' || resolution === undefined) {
    return NOT_ACTIONABLE;
  }
  if (resolution === expected) {
    return undefined;
  }
  return expected === 'complete' ? CHOICE_EXPECTED : NOTHING_TO_CHOOSE;
}

function fieldsRefusal(check: RefusedValues): Refusal {
  const sentences: string[] = [];
  if (check.missing.length > 0) {
    const labels = check.missing.join(', ');
    sentences.push(`Preencha os campos obrigatórios: ${labels}.`);
  }
  if (check.invalid.length > 0) {
    const labels = check.invalid.join(', ');
    sentences.push(`Corrija o valor dos campos: ${labels}.`);
  }
  return {
    code: check.missing.length > 0 ? 'missing-fields' : 'invalid-fields',
    message: sentences.join(' '),
  };
}

interface CompleteParams {
  readonly target: StepTarget;
  readonly action: CompleteAction;
}

export function completeStep(params: CompleteParams): RunResult {
  const { target, action } = params;
  const { token, place, at } = target;
  const { step } = place;
  const refusal = resolutionRefusal({ target, expected: 'complete' });
  if (refusal !== undefined) {
    return refused(refusal);
  }
  const check = validateValues({ fields: step.fields, values: action.values });
  if (!check.ok) {
    return refused(fieldsRefusal(check));
  }
  const dueAt = stepDueAt({ step, since: token.since });
  const early = step.kind === 'timer' && isBeforeDue({ at, dueAt });
  const event = stepEvent({
    target,
    kind: 'step',
    detail: early ? EARLY_TEXT : undefined,
    note: action.note,
    entries: check.entries,
  });
  return moveOn({ target, event, ways: [step.exits.at(0)], consume: true });
}

interface ExitIdsParams {
  readonly step: PlanStep;
  readonly exitIds: readonly string[];
}

function exitIdsRefusal(params: ExitIdsParams): Refusal | undefined {
  const { step, exitIds } = params;
  const ids = new Set(exitIds);
  const many = allowsManyChoices(step);
  if (ids.size === 0) {
    return many ? SOME_EXIT_NEEDED : ONE_EXIT_ONLY;
  }
  if (ids.size > 1 && !many) {
    return ONE_EXIT_ONLY;
  }
  const choices = choicesOf(step);
  const known = [...ids].every((id) => choices.some((exit) => exit.id === id));
  return known ? undefined : INVALID_EXIT;
}

interface ChooseParams {
  readonly target: StepTarget;
  readonly action: ChooseAction;
}

export function chooseExits(params: ChooseParams): RunResult {
  const { target, action } = params;
  const { token, place, at } = target;
  const { step } = place;
  const refusal =
    resolutionRefusal({ target, expected: 'choose' }) ??
    exitIdsRefusal({ step, exitIds: action.exitIds });
  if (refusal !== undefined) {
    return refused(refusal);
  }
  const chosen = choicesOf(step).filter((exit) =>
    action.exitIds.includes(exit.id),
  );
  const rejected = chosen.some((exit) => exit.meaning === 'rejected');
  if (rejected && cleanText(action.note) === undefined) {
    return refused(NOTE_REQUIRED);
  }
  const check = validateValues({ fields: step.fields, values: action.values });
  if (!check.ok) {
    return refused(fieldsRefusal(check));
  }
  const expired = chosen.some((exit) => exit.meaning === 'expired');
  const dueAt = stepDueAt({ step, since: token.since });
  const early = expired && isBeforeDue({ at, dueAt });
  const names = chosen.map(exitName).join(', ');
  const event = stepEvent({
    target,
    kind: step.kind === 'approval' ? 'approval' : 'choice',
    detail: early ? `${names} (${EARLY_TEXT})` : names,
    note: action.note,
    entries: check.entries,
  });
  return moveOn({ target, event, ways: chosen, consume: true });
}

interface RaiseParams {
  readonly target: StepTarget;
  readonly action: RaiseAction;
}

export function raiseEvent(params: RaiseParams): RunResult {
  const { target, action } = params;
  const { token, place, at } = target;
  // NOTE: a ficha em espera numa junção não está numa etapa ativa; a de escopo recebe a exceção do subprocesso.
  if (tokenState(token) === 'waiting') {
    return refused(NOT_ACTIONABLE);
  }
  const events = place.step.events ?? [];
  const raised = events.find((event) => event.id === action.eventId);
  if (raised === undefined) {
    return refused(UNKNOWN_EVENT);
  }
  const dueAt = eventDueAt({ event: raised, since: token.since });
  const name = eventName(raised);
  const event = stepEvent({
    target,
    kind: 'event',
    detail: isBeforeDue({ at, dueAt }) ? `${name} (${EARLY_TEXT})` : name,
    note: action.note,
  });
  return moveOn({
    target,
    event,
    ways: [raised],
    consume: raised.interrupting,
  });
}
