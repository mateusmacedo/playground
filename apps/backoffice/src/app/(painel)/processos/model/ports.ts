import {
  blockName,
  type GraphNode,
  type InputLimit,
  kindOf,
  OUTPUT_HANDLE,
  specOf,
} from './blocks';

/** Id da saída de Aguardar evento quando o evento chega. */
export const RECEIVED_HANDLE = 'received';
/** Id da saída de Aguardar evento quando o prazo termina antes do evento. */
export const EXPIRED_HANDLE = 'expired';

/** O que a passagem por uma saída significa, para o rótulo da conexão. */
export type TransitionMeaning =
  | 'next'
  | 'condition'
  | 'parallel'
  | 'received'
  | 'expired'
  | 'exception';

export interface OutputPort {
  readonly id: string;
  readonly meaning: TransitionMeaning;
  /** Nome da saída na tela; a saída única de uma atividade não tem nome. */
  readonly label?: string;
}

/** O que as portas de um bloco dependem: o tipo e os dados. */
export type PortNode = Pick<GraphNode, 'type' | 'data'>;

const EXCEPTION_LABEL = {
  error: 'Erro técnico',
  timeout: 'Tempo esgotado',
} as const;

function branchPorts(node: PortNode): OutputPort[] {
  const meaning: TransitionMeaning =
    kindOf(node) === 'parallel-split' ? 'parallel' : 'condition';
  const ports: OutputPort[] = [];
  for (const branch of node.data.branches ?? []) {
    ports.push({ id: branch.id, meaning, label: branch.label });
  }
  return ports;
}

function eventPorts(node: PortNode): OutputPort[] {
  const ports: OutputPort[] = [
    { id: RECEIVED_HANDLE, meaning: 'received', label: 'Evento recebido' },
  ];
  if (node.data.deadline !== undefined) {
    ports.push({
      id: EXPIRED_HANDLE,
      meaning: 'expired',
      label: 'Prazo expirado',
    });
  }
  return ports;
}

function singlePort(node: PortNode): OutputPort {
  if (kindOf(node) !== 'exception') {
    return { id: OUTPUT_HANDLE, meaning: 'next' };
  }
  const trigger = node.data.exceptionTrigger ?? 'error';
  return {
    id: OUTPUT_HANDLE,
    meaning: 'exception',
    label: EXCEPTION_LABEL[trigger],
  };
}

/** Saídas reais do bloco, na ordem da tela. */
export function outputPorts(node: PortNode): readonly OutputPort[] {
  const { output } = specOf(kindOf(node));
  if (output === 'single') {
    return [singlePort(node)];
  }
  if (output === 'branches') {
    return branchPorts(node);
  }
  if (output === 'events') {
    return eventPorts(node);
  }
  return [];
}

/** Ids dos pontos de saída do bloco. */
export function outputHandles(node: PortNode): readonly string[] {
  return outputPorts(node).map((port) => port.id);
}

export interface FindOutputPortParams {
  readonly node: PortNode;
  readonly handle: string;
}

export function findOutputPort(
  params: FindOutputPortParams,
): OutputPort | undefined {
  const { node, handle } = params;
  return outputPorts(node).find((port) => port.id === handle);
}

export function inputLimit(node: PortNode): InputLimit {
  return specOf(kindOf(node)).input;
}

/** Nome acessível do ponto de entrada: "Entrada de X". */
export function inputPortLabel(node: PortNode): string {
  return `Entrada de ${blockName(node)}`;
}

export interface OutputPortLabelParams {
  readonly node: PortNode;
  readonly port: OutputPort;
}

/** Nome acessível de uma saída: "Saída de X", "Ramo Y de X" ou o desfecho da espera ou da exceção. */
export function outputPortLabel(params: OutputPortLabelParams): string {
  const { node, port } = params;
  const name = blockName(node);
  if (port.meaning === 'condition' || port.meaning === 'parallel') {
    return `Ramo ${port.label} de ${name}`;
  }
  if (port.label) {
    return `Saída ${port.label} de ${name}`;
  }
  return `Saída de ${name}`;
}

/** Nome do significado da transição, mostrado junto ao rótulo da conexão. */
export const TRANSITION_TEXT: Readonly<Record<TransitionMeaning, string>> = {
  next: 'Sequência',
  condition: 'Condição',
  parallel: 'Ramo paralelo',
  received: 'Evento recebido',
  expired: 'Expiração',
  exception: 'Exceção',
};
