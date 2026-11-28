import { parseFields, type StepField } from '@/shared/process/fields';
import type {
  ExitMeaning,
  PlanDetail,
  PlanDuration,
  PlanEvent,
  PlanExit,
  PlanStep,
  ProcessPlan,
} from '@/shared/process/plan';
import {
  type BlockKind,
  blockName,
  type Duration,
  type Graph,
  type GraphNode,
  kindOf,
  OUTPUT_HANDLE,
  type StartTrigger,
} from './blocks';
import { sourceHandleOf } from './connections';
import { type BlockField, FIELD_LABEL } from './conversion';
import type { Lane, ProcessDocument } from './document';
import {
  channelLabel,
  formatSchedule,
  isDateTime,
  isDuration,
  isSchedule,
  OUTCOMES,
  outcomeText,
} from './fields';
import { outputPorts, type TransitionMeaning } from './ports';

/** Tipos de bloco que viram etapa: a exceção vira evento da etapa a que está presa, e a anotação fica de fora. */
type StepBlockKind = Exclude<BlockKind, 'exception' | 'annotation'>;

function isStepKind(kind: BlockKind): kind is StepBlockKind {
  return kind !== 'exception' && kind !== 'annotation';
}

/** Um nível do desenho (o processo ou o canvas de um subprocesso) e as raias que dão nome aos papéis. */
interface Level {
  readonly graph: Graph;
  readonly lanes: readonly Lane[];
}

interface LevelNode {
  readonly level: Level;
  readonly node: GraphNode;
}

/** O que só o tipo do bloco acrescenta à etapa, além do que toda etapa tem. */
type KindData = Partial<
  Omit<
    PlanStep,
    'id' | 'kind' | 'label' | 'description' | 'role' | 'exits' | 'events'
  >
>;

function filledText(value: string | undefined): string | undefined {
  const text = (value ?? '').trim();
  return text === '' ? undefined : text;
}

function validDuration(value: Duration | undefined): PlanDuration | undefined {
  return isDuration(value) ? value : undefined;
}

interface DetailSource {
  readonly field: BlockField;
  readonly value: string | undefined;
}

/** Dados de leitura do bloco com o rótulo do painel, só os preenchidos. */
function detailsOf(sources: readonly DetailSource[]): PlanDetail[] | undefined {
  const details: PlanDetail[] = [];
  for (const source of sources) {
    const value = filledText(source.value);
    if (value !== undefined) {
      details.push({ label: FIELD_LABEL[source.field], value });
    }
  }
  return details.length > 0 ? details : undefined;
}

/**
 * Campos a preencher como o roteiro os guarda: nome sem espaço nas pontas e lista só com as opções escritas. O campo
 * que a validação aponta (sem nome, lista sem opções) fica de fora, para o roteiro só levar o que dá para preencher.
 */
function fieldsOf(node: GraphNode): readonly StepField[] | undefined {
  return parseFields(node.data.fields);
}

const TRIGGER_TEXT: Readonly<Record<StartTrigger, string>> = {
  manual: 'Manual',
  message: 'Por mensagem',
  schedule: 'Por agendamento',
};

/** O agendamento e a mensagem só valem com o gatilho que os pede. */
function startData({ node }: LevelNode): KindData {
  const { data } = node;
  const trigger = data.trigger ?? 'manual';
  const schedule =
    trigger === 'schedule' && isSchedule(data.schedule)
      ? formatSchedule(data.schedule)
      : undefined;
  const message = trigger === 'message' ? data.triggerMessage : undefined;
  return {
    details: detailsOf([
      { field: 'trigger', value: TRIGGER_TEXT[trigger] },
      { field: 'schedule', value: schedule },
      { field: 'triggerMessage', value: message },
    ]),
  };
}

function taskData({ node }: LevelNode): KindData {
  return { fields: fieldsOf(node) };
}

function humanTaskData({ node }: LevelNode): KindData {
  const { data } = node;
  return {
    instructions: filledText(data.instructions),
    expectedResult: filledText(data.expectedResult),
    dueIn: validDuration(data.dueIn),
    fields: fieldsOf(node),
  };
}

function approvalData({ node }: LevelNode): KindData {
  const { data } = node;
  return {
    instructions: filledText(data.instructions),
    dueIn: validDuration(data.dueIn),
    fields: fieldsOf(node),
  };
}

function automatedTaskData({ node }: LevelNode): KindData {
  const { data } = node;
  return {
    details: detailsOf([
      { field: 'system', value: data.system },
      { field: 'operation', value: data.operation },
      { field: 'inputs', value: data.inputs },
      { field: 'outputs', value: data.outputs },
    ]),
  };
}

function messageData({ node }: LevelNode): KindData {
  const { data } = node;
  const channel = data.channel ? channelLabel(data.channel) : undefined;
  return {
    details: detailsOf([
      { field: 'recipient', value: data.recipient },
      { field: 'channel', value: channel },
      { field: 'content', value: data.content },
    ]),
  };
}

function waitData({ node }: LevelNode): KindData {
  const { data } = node;
  return {
    details: detailsOf([{ field: 'eventName', value: data.eventName }]),
    deadline: validDuration(data.deadline),
  };
}

/** O temporizador espera uma duração ou até uma data e horário, conforme o modo. */
function timerData({ node }: LevelNode): KindData {
  const { data } = node;
  if (data.timerMode === 'until') {
    return { until: isDateTime(data.until) ? data.until : undefined };
  }
  return { duration: validDuration(data.duration) };
}

/** O caminho padrão só vale enquanto é um dos ramos do bloco. */
function choiceData({ node }: LevelNode): KindData {
  const { branches = [], defaultBranchId } = node.data;
  const isBranch = branches.some((branch) => branch.id === defaultBranchId);
  return { defaultExitId: isBranch ? defaultBranchId : undefined };
}

function subprocessData({ level, node }: LevelNode): KindData {
  const { data } = node;
  return {
    details: detailsOf([
      { field: 'goal', value: data.goal },
      { field: 'inputs', value: data.inputs },
      { field: 'outputs', value: data.outputs },
    ]),
    // NOTE: canvas interno sem Início não dá roteiro, e o subprocesso passa a valer como tarefa simples.
    inner: data.process
      ? compileLevel({ graph: data.process, lanes: level.lanes })
      : undefined,
  };
}

function endData({ node }: LevelNode): KindData {
  const { data } = node;
  const option = OUTCOMES.find((candidate) => candidate.value === data.outcome);
  if (!option) {
    return {};
  }
  // NOTE: o desfecho "Outro" leva o nome dado pelo usuário; sem nome, fica o do próprio tipo.
  const label = outcomeText(data) || option.label;
  return { outcome: { kind: option.value, label } };
}

function noKindData(): KindData {
  return {};
}

/**
 * O que cada tipo de bloco acrescenta à etapa. Tipo novo de bloco entra aqui com a função dele; as saídas vêm das
 * portas do bloco, e o significado delas, de `EXIT_MEANING`.
 */
const KIND_DATA: Readonly<
  Record<StepBlockKind, (source: LevelNode) => KindData>
> = {
  start: startData,
  task: taskData,
  'human-task': humanTaskData,
  approval: approvalData,
  'automated-task': automatedTaskData,
  'send-message': messageData,
  'wait-event': waitData,
  timer: timerData,
  decision: choiceData,
  merge: noKindData,
  'inclusive-split': choiceData,
  'inclusive-join': noKindData,
  'parallel-split': noKindData,
  'parallel-join': noKindData,
  subprocess: subprocessData,
  end: endData,
};

/** Significado de cada saída no roteiro: ramo com condição e ramo paralelo são, os dois, um ramo. */
const EXIT_MEANING: Readonly<Record<TransitionMeaning, ExitMeaning>> = {
  next: 'next',
  condition: 'branch',
  parallel: 'branch',
  received: 'received',
  expired: 'expired',
  approved: 'approved',
  rejected: 'rejected',
  // NOTE: a saída do bloco de exceção vira o destino do evento, nunca uma saída de etapa.
  exception: 'next',
};

interface TargetParams {
  readonly level: Level;
  readonly sourceId: string;
  readonly handle: string;
}

/** Etapa aonde o ponto de saída leva; sem conexão, ou com destino que não é etapa do nível, o caminho termina ali. */
function targetOf(params: TargetParams): string | undefined {
  const { level, sourceId, handle } = params;
  const edge = level.graph.edges.find(
    (candidate) =>
      candidate.source === sourceId && sourceHandleOf(candidate) === handle,
  );
  const target = level.graph.nodes.find(
    (candidate) => candidate.id === edge?.target,
  );
  return target && isStepKind(kindOf(target)) ? target.id : undefined;
}

function exitsOf({ level, node }: LevelNode): PlanExit[] {
  const branches = node.data.branches ?? [];
  const exits: PlanExit[] = [];
  for (const port of outputPorts(node)) {
    const branch = branches.find((candidate) => candidate.id === port.id);
    exits.push({
      id: port.id,
      meaning: EXIT_MEANING[port.meaning],
      label: filledText(port.label),
      condition: filledText(branch?.condition),
      description: filledText(branch?.description),
      to: targetOf({ level, sourceId: node.id, handle: port.id }),
    });
  }
  return exits;
}

function toEvent({ level, node }: LevelNode): PlanEvent {
  const { data } = node;
  const trigger = data.exceptionTrigger ?? 'error';
  return {
    id: node.id,
    label: blockName(node),
    trigger,
    // NOTE: a exceção interrompe a atividade, a não ser que o usuário desmarque a opção.
    interrupting: data.interrupting !== false,
    timeout: trigger === 'timeout' ? validDuration(data.timeout) : undefined,
    to: targetOf({ level, sourceId: node.id, handle: OUTPUT_HANDLE }),
  };
}

/** Exceções presas ao bloco, na ordem do desenho. */
function eventsOf({ level, node }: LevelNode): PlanEvent[] | undefined {
  const events: PlanEvent[] = [];
  for (const candidate of level.graph.nodes) {
    if (kindOf(candidate) === 'exception' && candidate.parentId === node.id) {
      events.push(toEvent({ level, node: candidate }));
    }
  }
  return events.length > 0 ? events : undefined;
}

interface StepSource extends LevelNode {
  readonly kind: StepBlockKind;
}

function toStep({ level, node, kind }: StepSource): PlanStep {
  const { data } = node;
  const lane = level.lanes.find((candidate) => candidate.id === data.laneId);
  return {
    id: node.id,
    kind,
    label: blockName(node),
    description: filledText(data.description),
    role: filledText(data.role) ?? filledText(lane?.name),
    exits: exitsOf({ level, node }),
    events: eventsOf({ level, node }),
    ...KIND_DATA[kind]({ level, node }),
  };
}

/** Roteiro de um nível; `undefined` quando ele não tem Início, porque não há por onde começar. */
function compileLevel(level: Level): ProcessPlan | undefined {
  const { nodes } = level.graph;
  const start = nodes.find((node) => kindOf(node) === 'start');
  if (!start) {
    return undefined;
  }
  const steps: PlanStep[] = [];
  for (const node of nodes) {
    const kind = kindOf(node);
    if (isStepKind(kind)) {
      steps.push(toStep({ level, node, kind }));
    }
  }
  return { startId: start.id, steps };
}

/** Roteiro de um desenho sem Início: nenhuma etapa, porque não há o que executar. */
const EMPTY_PLAN: ProcessPlan = { startId: '', steps: [] };

/**
 * Roteiro que o motor executa, a partir do desenho do editor. Cada bloco vira uma etapa com o mesmo id; a exceção vira
 * evento da etapa a que está presa; a anotação fica de fora; e o canvas de cada subprocesso é compilado dentro da
 * etapa dele. O desenho não é validado aqui: quem publica confere antes os problemas do processo.
 */
export function compilePlan(document: ProcessDocument): ProcessPlan {
  const level: Level = { graph: document.graph, lanes: document.lanes };
  return compileLevel(level) ?? EMPTY_PLAN;
}
