import { MAIN_PROCESS_ID } from './definition-documents';
import type { ProcessDefinitionSeed } from './mock-documents';
import { EXAMPLE_PROCESS } from './process-documents';
import {
  connect,
  type DraftParams,
  definitionWithDraft,
  endNode,
  LANE_WIDTH,
  startNode,
} from './process-drafts';

/** Troca o rascunho do processo dos dados iniciais pelo desenho dado. */
export function mainProcessWith(draft: DraftParams): ProcessDefinitionSeed {
  return definitionWithDraft({
    id: MAIN_PROCESS_ID,
    name: EXAMPLE_PROCESS,
    draft,
  });
}

/** Duas raias e uma tarefa humana na primeira, com o papel dela. */
export const LANES_DRAFT: DraftParams = {
  lanes: [
    { id: 'lane-sales', name: 'Comercial', width: LANE_WIDTH },
    { id: 'lane-legal', name: 'Jurídico', width: LANE_WIDTH },
  ],
  nodes: [
    startNode({ x: 38, y: 0 }),
    {
      id: 'review',
      type: 'human-task',
      position: { x: 38, y: 120 },
      data: {
        label: 'Analisar contrato',
        laneId: 'lane-sales',
        role: 'Comercial',
      },
    },
    endNode({ x: 38, y: 280 }),
  ],
  edges: [
    connect({ source: 'start', target: 'review' }),
    connect({ source: 'review', target: 'end' }),
  ],
};

/** Uma decisão com os ramos "Sim" e "Não", cada um levando a uma tarefa. */
export const DECISION_DRAFT: DraftParams = {
  nodes: [
    startNode({ x: 200, y: 0 }),
    {
      id: 'high',
      type: 'decision',
      position: { x: 200, y: 120 },
      data: {
        label: 'Valor alto?',
        branches: [
          { id: 'yes', label: 'Sim' },
          { id: 'no', label: 'Não' },
        ],
      },
    },
    {
      id: 'quote',
      type: 'task',
      position: { x: 0, y: 280 },
      data: { label: 'Pedir cotação' },
    },
    {
      id: 'pay',
      type: 'task',
      position: { x: 400, y: 280 },
      data: { label: 'Pagar' },
    },
    endNode({ x: 200, y: 440 }),
  ],
  edges: [
    connect({ source: 'start', target: 'high' }),
    connect({ source: 'high', target: 'quote', sourceHandle: 'yes' }),
    connect({ source: 'high', target: 'pay', sourceHandle: 'no' }),
    connect({ source: 'quote', target: 'end' }),
    connect({ source: 'pay', target: 'end' }),
  ],
};

export const LOOSE_STEP = 'Etapa solta';

/**
 * O processo de exemplo com uma etapa solta, longe do resto: dois problemas para enquadrar. A distância cabe no zoom
 * mínimo do canvas, para "Ajustar à tela" mostrar tudo.
 */
export const LOOSE_STEP_DRAFT: DraftParams = {
  nodes: [
    startNode({ x: 40, y: 0 }),
    {
      id: 'task-1',
      type: 'task',
      position: { x: 0, y: 120 },
      data: { label: 'Primeira etapa' },
    },
    endNode({ x: 40, y: 280 }),
    {
      id: 'loose',
      type: 'task',
      position: { x: 900, y: 700 },
      data: { label: LOOSE_STEP },
    },
  ],
  edges: [
    connect({ source: 'start', target: 'task-1' }),
    connect({ source: 'task-1', target: 'end' }),
  ],
};
