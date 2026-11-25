import type { BlockData, GraphEdge, GraphNode } from './blocks';

/** Bloco mínimo para os testes do modelo. */
export function block(
  id: string,
  type: string,
  data: Partial<BlockData> = {},
): GraphNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: data.label ?? id, ...data },
  };
}

/** Conexão mínima; `sourceHandle` padrão é a saída única. */
export function link(
  source: string,
  target: string,
  sourceHandle = 'out',
): GraphEdge {
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
