export type BlockKind =
  | 'start'
  | 'task'
  | 'human-task'
  | 'automated-task'
  | 'send-message'
  | 'wait-event'
  | 'timer'
  | 'decision'
  | 'merge'
  | 'inclusive-split'
  | 'inclusive-join'
  | 'parallel-split'
  | 'parallel-join'
  | 'exception'
  | 'subprocess'
  | 'end'
  | 'annotation';

/** Um caminho de saída de uma decisão ou abertura; o `id` também é o id do ponto de saída dele. */
export interface Branch {
  readonly id: string;
  readonly label: string;
  readonly condition?: string;
  readonly description?: string;
}

export type StartTrigger = 'manual' | 'message' | 'schedule';
export type TimerMode = 'duration' | 'until';
export type ExceptionTrigger = 'error' | 'timeout';

export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';

/** Intervalo de tempo: quantidade inteira e positiva numa unidade de relógio. */
export interface Duration {
  readonly amount: number;
  readonly unit: DurationUnit;
}

export type ScheduleRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';

/** Dia do mês do agendamento mensal: 1 a 28, que todo mês tem, ou o último dia. */
export type MonthDay = number | 'last';

/** Quando o processo começa sozinho; cada recorrência usa só os campos dela. */
export interface Schedule {
  readonly recurrence: ScheduleRecurrence;
  /** Horário `HH:MM`, de 00:00 a 23:59. */
  readonly time: string;
  /** Data `AAAA-MM-DD`, só na execução única. */
  readonly date?: string;
  /** Dia da semana de 0 (domingo) a 6 (sábado), só na semanal. */
  readonly weekday?: number;
  readonly monthDay?: MonthDay;
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'in-app';

export type EndOutcome =
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'other';

/** Grafo interno de um subprocesso, salvo dentro do próprio bloco. */
export type InnerProcess = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
};

// WHY: `type`, e não `interface`, porque o React Flow exige `data` atribuível a `Record<string, unknown>`, e só alias
// de tipo ganha a assinatura de índice implícita. Os campos são opcionais e planos: cada tipo de bloco usa os seus
// (lista em `conversion.ts`), e a conversão entre tipos só precisa saber quais deles somem.
export type BlockData = {
  readonly label: string;
  readonly description?: string;
  readonly laneId?: string;
  readonly branches?: readonly Branch[];
  readonly defaultBranchId?: string;
  readonly trigger?: StartTrigger;
  readonly schedule?: Schedule;
  readonly triggerMessage?: string;
  readonly role?: string;
  readonly instructions?: string;
  readonly expectedResult?: string;
  readonly dueIn?: Duration;
  readonly system?: string;
  readonly operation?: string;
  readonly inputs?: string;
  readonly outputs?: string;
  readonly recipient?: string;
  readonly channel?: MessageChannel;
  readonly content?: string;
  readonly eventName?: string;
  /** Prazo da espera; sem ele, a espera não tem a saída "Prazo expirado". */
  readonly deadline?: Duration;
  readonly timerMode?: TimerMode;
  readonly duration?: Duration;
  /** Data e horário locais `AAAA-MM-DDTHH:MM`. */
  readonly until?: string;
  readonly pairId?: string;
  readonly exceptionTrigger?: ExceptionTrigger;
  /** Limite de tempo da tarefa, quando a exceção é por tempo esgotado. */
  readonly timeout?: Duration;
  readonly interrupting?: boolean;
  readonly goal?: string;
  readonly process?: InnerProcess;
  readonly outcome?: EndOutcome;
  /** Nome do desfecho quando ele é "Outro". */
  readonly outcomeLabel?: string;
};

/** Dados próprios da conexão; o rótulo de um ramo vem do ramo, não daqui. */
export type LinkData = {
  readonly label?: string;
};

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** O mínimo de um bloco que as regras leem; os nós do React Flow já têm esse formato. */
export interface GraphNode {
  readonly id: string;
  readonly type?: string;
  readonly position: Point;
  readonly data: BlockData;
  readonly selected?: boolean;
  /** Tarefa à qual um Evento de exceção está preso; a posição dele é relativa a ela. */
  readonly parentId?: string;
}

/** O mínimo de uma conexão que as regras leem. */
export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
  readonly selected?: boolean;
}

export interface Graph<
  N extends GraphNode = GraphNode,
  E extends GraphEdge = GraphEdge,
> {
  readonly nodes: readonly N[];
  readonly edges: readonly E[];
}

/** Quantas conexões o bloco aceita chegando: nenhuma, uma ou várias. */
export type InputLimit = 'none' | 'one' | 'many';

/**
 * Como o bloco sai: sem saída, por uma saída única, por um ponto por ramo ou pelos desfechos de uma espera (evento
 * recebido e, com prazo, prazo expirado).
 */
export type OutputMode = 'none' | 'single' | 'branches' | 'events';

export type BlockCategory = 'events' | 'activities' | 'gateways' | 'notes';

export interface BlockSpec {
  readonly kind: BlockKind;
  readonly label: string;
  readonly hint: string;
  readonly category: BlockCategory;
  readonly input: InputLimit;
  readonly output: OutputMode;
}

/** Id do ponto de entrada de todo bloco que aceita conexão. */
export const INPUT_HANDLE = 'in';
/** Id do ponto de saída dos blocos de saída única. */
export const OUTPUT_HANDLE = 'out';

const SPEC_BY_KIND: Readonly<Record<BlockKind, BlockSpec>> = {
  start: {
    kind: 'start',
    label: 'Início',
    hint: 'Ponto de partida do processo.',
    category: 'events',
    input: 'none',
    output: 'single',
  },
  task: {
    kind: 'task',
    label: 'Etapa',
    hint: 'Uma atividade do processo, ainda sem responsável definido.',
    category: 'activities',
    input: 'one',
    output: 'single',
  },
  'human-task': {
    kind: 'human-task',
    label: 'Tarefa humana',
    hint: 'Atividade feita por uma pessoa com um papel definido.',
    category: 'activities',
    input: 'one',
    output: 'single',
  },
  'automated-task': {
    kind: 'automated-task',
    label: 'Tarefa automatizada',
    hint: 'Operação executada por um sistema.',
    category: 'activities',
    input: 'one',
    output: 'single',
  },
  'send-message': {
    kind: 'send-message',
    label: 'Enviar mensagem',
    hint: 'Envia uma mensagem e segue o fluxo.',
    category: 'activities',
    input: 'one',
    output: 'single',
  },
  'wait-event': {
    kind: 'wait-event',
    label: 'Aguardar evento',
    hint: 'Espera um evento, com prazo opcional.',
    category: 'events',
    input: 'one',
    output: 'events',
  },
  timer: {
    kind: 'timer',
    label: 'Temporizador',
    hint: 'Espera uma duração ou até uma data e horário.',
    category: 'events',
    input: 'one',
    output: 'single',
  },
  decision: {
    kind: 'decision',
    label: 'Decisão exclusiva',
    hint: 'Segue por um único caminho a cada passagem.',
    category: 'gateways',
    input: 'one',
    output: 'branches',
  },
  merge: {
    kind: 'merge',
    label: 'Convergência de alternativas',
    hint: 'Reúne caminhos alternativos; cada chegada segue sozinha.',
    category: 'gateways',
    input: 'many',
    output: 'single',
  },
  'inclusive-split': {
    kind: 'inclusive-split',
    label: 'Decisão inclusiva',
    hint: 'Segue por todos os caminhos cuja condição for atendida.',
    category: 'gateways',
    input: 'one',
    output: 'branches',
  },
  'inclusive-join': {
    kind: 'inclusive-join',
    label: 'Junção inclusiva',
    hint: 'Espera os caminhos ativados pela decisão inclusiva.',
    category: 'gateways',
    input: 'many',
    output: 'single',
  },
  'parallel-split': {
    kind: 'parallel-split',
    label: 'Abertura paralela',
    hint: 'Ativa todos os caminhos ao mesmo tempo.',
    category: 'gateways',
    input: 'one',
    output: 'branches',
  },
  'parallel-join': {
    kind: 'parallel-join',
    label: 'Sincronização paralela',
    hint: 'Espera todos os caminhos da abertura paralela.',
    category: 'gateways',
    input: 'many',
    output: 'single',
  },
  exception: {
    kind: 'exception',
    label: 'Evento de exceção',
    hint: 'Desvio por erro técnico ou tempo esgotado de uma tarefa.',
    category: 'events',
    input: 'none',
    output: 'single',
  },
  subprocess: {
    kind: 'subprocess',
    label: 'Subprocesso',
    hint: 'Agrupa um trecho do processo num canvas próprio.',
    category: 'activities',
    input: 'one',
    output: 'single',
  },
  end: {
    kind: 'end',
    label: 'Fim',
    hint: 'Encerra o processo com um desfecho.',
    category: 'events',
    input: 'many',
    output: 'none',
  },
  annotation: {
    kind: 'annotation',
    label: 'Anotação',
    hint: 'Nota livre, sem conexões.',
    category: 'notes',
    input: 'none',
    output: 'none',
  },
};

export interface CategorySpec {
  readonly category: BlockCategory;
  readonly label: string;
}

/** Grupos da biblioteca, na ordem da tela. */
export const BLOCK_CATEGORIES: readonly CategorySpec[] = [
  { category: 'events', label: 'Eventos' },
  { category: 'activities', label: 'Atividades' },
  { category: 'gateways', label: 'Desvios' },
  { category: 'notes', label: 'Notas' },
];

/** Os blocos na ordem da biblioteca. */
export const BLOCK_SPECS: readonly BlockSpec[] = [
  SPEC_BY_KIND.start,
  SPEC_BY_KIND['wait-event'],
  SPEC_BY_KIND.timer,
  SPEC_BY_KIND.exception,
  SPEC_BY_KIND.end,
  SPEC_BY_KIND.task,
  SPEC_BY_KIND['human-task'],
  SPEC_BY_KIND['automated-task'],
  SPEC_BY_KIND['send-message'],
  SPEC_BY_KIND.subprocess,
  SPEC_BY_KIND.decision,
  SPEC_BY_KIND.merge,
  SPEC_BY_KIND['inclusive-split'],
  SPEC_BY_KIND['inclusive-join'],
  SPEC_BY_KIND['parallel-split'],
  SPEC_BY_KIND['parallel-join'],
  SPEC_BY_KIND.annotation,
];

export function isBlockKind(value: unknown): value is BlockKind {
  return typeof value === 'string' && Object.hasOwn(SPEC_BY_KIND, value);
}

/** Tipo do bloco; um nó sem tipo conhecido conta como Etapa, o tipo padrão. */
export function kindOf(node: Pick<GraphNode, 'type'>): BlockKind {
  return isBlockKind(node.type) ? node.type : 'task';
}

export function specOf(kind: BlockKind): BlockSpec {
  return SPEC_BY_KIND[kind];
}

/** Nome do bloco na tela: o título dado pelo usuário ou, vazio, o nome do tipo. */
export function blockName(node: Pick<GraphNode, 'type' | 'data'>): string {
  return node.data.label.trim() || specOf(kindOf(node)).label;
}

/** Tipos que se dividem em ramos com nome. */
export function hasBranches(kind: BlockKind): boolean {
  return specOf(kind).output === 'branches';
}

/** Tipos de atividade que aceitam um Evento de exceção preso à borda. */
export function acceptsExceptions(kind: BlockKind): boolean {
  return (
    kind === 'human-task' || kind === 'automated-task' || kind === 'subprocess'
  );
}

/** Par de cada tipo que referencia uma abertura: a sincronização aponta a abertura paralela; a junção, a inclusiva. */
export const PAIRED_SPLIT: Readonly<Partial<Record<BlockKind, BlockKind>>> = {
  'parallel-join': 'parallel-split',
  'inclusive-join': 'inclusive-split',
};
