import type { JsonObject, ProcessDefinitionSeed } from './mock-documents';
import { initialDefinition } from './mock-samples';

// NOTE: o rascunho de um processo é o documento do editor gravado como texto JSON. Os campos aqui seguem o formato que o
// editor salva (versão 2): raias lado a lado a partir de x = 0 e blocos com posição, tipo e dados.
const DRAFT_VERSION = 2;
const SEEDED_AT = '2026-11-26T12:00:00.000Z';
/** Largura de uma raia nova no editor, em pixels do canvas. */
export const LANE_WIDTH = 256;

export interface DraftLane extends JsonObject {
  readonly id: string;
  readonly name: string;
  readonly width: number;
}

export interface DraftNode extends JsonObject {
  readonly id: string;
  readonly type: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly data: JsonObject;
}

export interface DraftEdge extends JsonObject {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle: string;
  readonly targetHandle: string;
}

export interface DraftParams {
  readonly lanes?: readonly DraftLane[];
  readonly nodes: readonly DraftNode[];
  readonly edges?: readonly DraftEdge[];
}

/** O texto do rascunho, como o editor o grava. */
export function draftText({
  lanes = [],
  nodes,
  edges = [],
}: DraftParams): string {
  return JSON.stringify({
    version: DRAFT_VERSION,
    lanes,
    graph: { nodes, edges },
  });
}

export interface ConnectParams {
  readonly source: string;
  readonly target: string;
  /** A saída do bloco de origem: `out` na saída única, o id do ramo numa decisão. */
  readonly sourceHandle?: string;
}

/** A conexão entre dois blocos, da saída indicada à entrada do destino. */
export function connect({
  source,
  target,
  sourceHandle = 'out',
}: ConnectParams): DraftEdge {
  return {
    id: `${source}-${sourceHandle}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle: 'in',
  };
}

export interface DefinitionWithDraftParams {
  readonly id: string;
  readonly name: string;
  readonly draft: DraftParams;
}

/**
 * Um processo do catálogo com o rascunho dado e nenhuma versão publicada: no editor, ele aparece como "Rascunho" e
 * publica a versão 1.
 */
export function definitionWithDraft({
  id,
  name,
  draft,
}: DefinitionWithDraftParams): ProcessDefinitionSeed {
  const initial = initialDefinition();
  return {
    ...initial,
    id,
    definition: {
      id,
      name,
      createdAt: SEEDED_AT,
      updatedAt: SEEDED_AT,
      draftText: draftText(draft),
      versions: [],
    },
  };
}

export interface CopyOfInitialParams {
  readonly id: string;
  readonly name: string;
  /** Novo título da "Primeira etapa", para o canvas mostrar qual processo está aberto. */
  readonly stepTitle: string;
}

/** O processo dos dados iniciais com outro id, outro nome e a etapa renomeada, sem versão publicada. */
export function copyOfInitialDefinition({
  id,
  name,
  stepTitle,
}: CopyOfInitialParams): ProcessDefinitionSeed {
  return definitionWithDraft({
    id,
    name,
    draft: {
      nodes: [
        startNode({ x: 40, y: 0 }),
        {
          id: 'task-1',
          type: 'task',
          position: { x: 0, y: 120 },
          data: { label: stepTitle },
        },
        endNode({ x: 40, y: 280 }),
      ],
      edges: [
        connect({ source: 'start', target: 'task-1' }),
        connect({ source: 'task-1', target: 'end' }),
      ],
    },
  });
}

type Position = DraftNode['position'];

export function startNode(position: Position): DraftNode {
  return {
    id: 'start',
    type: 'start',
    position,
    data: { label: 'Início', trigger: 'manual' },
  };
}

export function endNode(position: Position): DraftNode {
  return {
    id: 'end',
    type: 'end',
    position,
    data: { label: 'Fim', outcome: 'completed' },
  };
}

/** A quantidade de blocos do nível principal de um rascunho gravado. */
export function draftNodeCount(text: string): number {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'graph' in parsed &&
    typeof parsed.graph === 'object' &&
    parsed.graph !== null &&
    'nodes' in parsed.graph &&
    Array.isArray(parsed.graph.nodes)
  ) {
    return parsed.graph.nodes.length;
  }
  throw new Error('O rascunho gravado não tem a lista de blocos.');
}
