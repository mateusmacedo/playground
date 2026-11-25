import {
  acceptsExceptions,
  type BlockData,
  type BlockKind,
  type Graph,
  type GraphEdge,
  type GraphNode,
  kindOf,
  specOf,
} from './blocks';
import { sourceHandleOf } from './connections';
import { outputHandles } from './ports';

/** Campo de dados próprio de algum tipo; título e raia valem para todos e não entram aqui. */
export type BlockField = Exclude<keyof BlockData, 'label' | 'laneId'>;

/** Campos que cada tipo usa, na ordem do painel. */
export const FIELDS_BY_KIND: Readonly<
  Record<BlockKind, readonly BlockField[]>
> = {
  start: ['trigger'],
  task: ['description'],
  'human-task': [
    'description',
    'role',
    'instructions',
    'expectedResult',
    'dueIn',
  ],
  'automated-task': ['description', 'system', 'operation', 'inputs', 'outputs'],
  'send-message': ['description', 'recipient', 'channel', 'content'],
  'wait-event': ['description', 'eventName', 'deadline'],
  timer: ['description', 'timerMode', 'duration', 'until'],
  decision: ['description', 'branches', 'defaultBranchId'],
  merge: ['description'],
  'inclusive-split': ['description', 'branches', 'defaultBranchId'],
  'inclusive-join': ['description', 'pairId'],
  'parallel-split': ['description', 'branches'],
  'parallel-join': ['description', 'pairId'],
  exception: ['exceptionTrigger', 'interrupting'],
  subprocess: ['description', 'goal', 'inputs', 'outputs', 'process'],
  end: ['outcome'],
  annotation: [],
};

export const FIELD_LABEL: Readonly<Record<BlockField, string>> = {
  description: 'Descrição',
  branches: 'Ramos',
  defaultBranchId: 'Caminho padrão',
  trigger: 'Gatilho',
  role: 'Papel responsável',
  instructions: 'Instruções',
  expectedResult: 'Resultado esperado',
  dueIn: 'Prazo de atendimento',
  system: 'Sistema',
  operation: 'Operação',
  inputs: 'Entradas',
  outputs: 'Saídas esperadas',
  recipient: 'Destinatário',
  channel: 'Canal',
  content: 'Conteúdo ou modelo',
  eventName: 'Evento aguardado',
  deadline: 'Prazo',
  timerMode: 'Tipo de espera',
  duration: 'Duração',
  until: 'Data e horário',
  pairId: 'Abertura correspondente',
  exceptionTrigger: 'Gatilho da exceção',
  interrupting: 'Interrompe a atividade',
  goal: 'Objetivo',
  process: 'Canvas interno',
  outcome: 'Desfecho',
};

/** Conversões oferecidas no painel de cada tipo. */
export const CONVERSIONS: Readonly<
  Partial<Record<BlockKind, readonly BlockKind[]>>
> = {
  task: ['human-task', 'automated-task'],
};

export interface ConversionReport {
  /** Nomes dos campos preenchidos que o tipo novo não tem. */
  readonly lostFields: readonly string[];
  readonly lostEdgeIds: readonly string[];
  /** Exceções presas ao bloco que saem junto, quando o tipo novo não aceita exceção. */
  readonly lostNodeIds: readonly string[];
}

export interface ConversionParams<N extends GraphNode, E extends GraphEdge> {
  readonly graph: Graph<N, E>;
  readonly nodeId: string;
  readonly to: BlockKind;
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

interface ConvertNodeParams<N extends GraphNode> {
  readonly node: N;
  readonly to: BlockKind;
}

function droppedFields(params: ConvertNodeParams<GraphNode>): BlockField[] {
  const { node, to } = params;
  const kept = FIELDS_BY_KIND[to];
  const dropped: BlockField[] = [];
  for (const field of FIELDS_BY_KIND[kindOf(node)]) {
    if (!kept.includes(field) && hasValue(node.data[field])) {
      dropped.push(field);
    }
  }
  return dropped;
}

function convertedNode<N extends GraphNode>(params: ConvertNodeParams<N>): N {
  const { node, to } = params;
  let data: BlockData = node.data;
  for (const field of droppedFields({ node, to })) {
    data = { ...data, [field]: undefined };
  }
  return { ...node, type: to, data };
}

/** O que se perde ao converter o bloco: campos preenchidos, conexões sem ponto no tipo novo e exceções presas. */
export function conversionReport<N extends GraphNode, E extends GraphEdge>(
  params: ConversionParams<N, E>,
): ConversionReport {
  const { graph, nodeId, to } = params;
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return { lostFields: [], lostEdgeIds: [], lostNodeIds: [] };
  }
  const lostFields = droppedFields({ node, to }).map(
    (field) => FIELD_LABEL[field],
  );
  const handles = outputHandles({ ...node, type: to });
  const acceptsInput = specOf(to).input !== 'none';
  const lostEdgeIds: string[] = [];
  for (const edge of graph.edges) {
    const lostOutput =
      edge.source === nodeId && !handles.includes(sourceHandleOf(edge));
    const lostInput = edge.target === nodeId && !acceptsInput;
    if (lostOutput || lostInput) {
      lostEdgeIds.push(edge.id);
    }
  }
  const lostNodeIds = acceptsExceptions(to)
    ? []
    : graph.nodes
        .filter((candidate) => candidate.parentId === nodeId)
        .map((candidate) => candidate.id);
  return { lostFields, lostEdgeIds, lostNodeIds };
}

/** Troca o tipo do bloco mantendo id, posição e o que for compatível; o resto sai, como o relatório avisa. */
export function convertBlock<N extends GraphNode, E extends GraphEdge>(
  params: ConversionParams<N, E>,
): Graph<N, E> {
  const { graph, nodeId, to } = params;
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || kindOf(node) === to) {
    return graph;
  }
  const report = conversionReport(params);
  const nodes: N[] = [];
  for (const candidate of graph.nodes) {
    if (report.lostNodeIds.includes(candidate.id)) {
      continue;
    }
    nodes.push(
      candidate.id === nodeId
        ? convertedNode({ node: candidate, to })
        : candidate,
    );
  }
  const edges = graph.edges.filter((edge) => {
    const touchesLostNode =
      report.lostNodeIds.includes(edge.source) ||
      report.lostNodeIds.includes(edge.target);
    return !report.lostEdgeIds.includes(edge.id) && !touchesLostNode;
  });
  return { nodes, edges };
}
