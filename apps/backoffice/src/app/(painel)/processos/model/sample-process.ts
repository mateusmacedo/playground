import { type Graph, INPUT_HANDLE, OUTPUT_HANDLE } from './blocks';

/** Processo inicial do editor enquanto não há onde salvar: o menor fluxo completo. */
export const sampleProcess: Graph = {
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 40, y: 0 },
      data: { label: 'Início', trigger: 'manual' },
    },
    {
      id: 'task-1',
      type: 'task',
      position: { x: 0, y: 120 },
      data: { label: 'Primeira etapa', description: 'Descreva a atividade.' },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 40, y: 280 },
      data: { label: 'Fim', outcome: 'completed' },
    },
  ],
  edges: [
    {
      id: 'start-task-1',
      source: 'start',
      target: 'task-1',
      sourceHandle: OUTPUT_HANDLE,
      targetHandle: INPUT_HANDLE,
    },
    {
      id: 'task-1-end',
      source: 'task-1',
      target: 'end',
      sourceHandle: OUTPUT_HANDLE,
      targetHandle: INPUT_HANDLE,
    },
  ],
};
