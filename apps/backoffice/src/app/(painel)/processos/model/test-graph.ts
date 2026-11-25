import type { BlockData, GraphEdge, GraphNode } from './blocks';

export interface BlockParams {
  readonly id: string;
  readonly type: string;
  readonly data?: Partial<BlockData>;
}

/** Bloco mínimo para os testes do modelo. */
export function block({
  id,
  type,
  data = {},
}: Readonly<BlockParams>): GraphNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: data.label ?? id, ...data },
  };
}

export interface LinkParams {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string;
}

/** Conexão mínima; `sourceHandle` padrão é a saída única. */
export function link({
  source,
  target,
  sourceHandle = 'out',
}: Readonly<LinkParams>): GraphEdge {
  return {
    id: `${source}-${sourceHandle}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle: 'in',
  };
}

export const decisionBranches = [
  { id: 'yes', label: 'Sim' },
  { id: 'no', label: 'Não' },
];

/** Gerador de ids previsíveis: `copy-1`, `copy-2` e assim por diante. */
export function sequentialIds(prefix = 'copy'): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
}
