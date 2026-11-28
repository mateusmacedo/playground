import type { ProcessPlan } from '@/shared/process/plan';

import type { BoardProcess } from './board';

/** Roteiro com os tipos de etapa e os dados opcionais que o quadro guarda congelados. */
const plan: ProcessPlan = {
  startId: 'start',
  steps: [
    {
      id: 'start',
      kind: 'start',
      label: 'Início',
      exits: [{ id: 'out', meaning: 'next', to: 'triage' }],
    },
    {
      id: 'triage',
      kind: 'human-task',
      label: 'Triar o pedido',
      description: 'Confere se o pedido tem o que precisa para seguir.',
      role: 'Atendimento',
      instructions: 'Leia o pedido e anote o que falta.',
      expectedResult: 'Pedido pronto para a análise.',
      dueIn: { amount: 2, unit: 'days' },
      details: [{ label: 'Canal', value: 'Portal' }],
      fields: [
        { id: 'summary', label: 'Resumo', type: 'text', required: true },
        {
          id: 'notes',
          label: 'Observações',
          type: 'long-text',
          required: false,
        },
        { id: 'amount', label: 'Valor', type: 'number', required: false },
        { id: 'received', label: 'Recebido em', type: 'date', required: false },
        {
          id: 'priority',
          label: 'Prioridade',
          type: 'choice',
          required: true,
          options: ['Normal', 'Alta'],
        },
        { id: 'complete', label: 'Completo', type: 'checkbox', required: true },
      ],
      exits: [{ id: 'out', meaning: 'next', to: 'analysis' }],
      events: [
        {
          id: 'late',
          label: 'Triagem atrasada',
          trigger: 'timeout',
          interrupting: false,
          timeout: { amount: 3, unit: 'days' },
          to: 'end-expired',
        },
      ],
    },
    {
      id: 'analysis',
      kind: 'task',
      label: 'Analisar o pedido',
      exits: [{ id: 'out', meaning: 'next', to: 'approval' }],
    },
    {
      id: 'approval',
      kind: 'approval',
      label: 'Aprovar o pedido',
      role: 'Gestão',
      exits: [
        { id: 'approved', meaning: 'approved', label: 'Aprovado', to: 'end' },
        {
          id: 'rejected',
          meaning: 'rejected',
          label: 'Recusado',
          to: 'end-rejected',
        },
      ],
    },
    {
      id: 'end',
      kind: 'end',
      label: 'Atendido',
      exits: [],
      outcome: { kind: 'completed', label: 'Pedido atendido' },
    },
    {
      id: 'end-rejected',
      kind: 'end',
      label: 'Recusado',
      exits: [],
      outcome: { kind: 'rejected', label: 'Pedido recusado' },
    },
    {
      id: 'end-expired',
      kind: 'end',
      label: 'Fora do prazo',
      exits: [],
      outcome: { kind: 'expired', label: 'Pedido fora do prazo' },
    },
  ],
};

/** Versão de processo que o card da amostra segue. */
export const sampleProcess: BoardProcess = {
  definitionId: 'process-1',
  version: 2,
  name: 'Atendimento de pedido',
  plan,
};
