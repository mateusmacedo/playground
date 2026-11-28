import type { ProcessPlan } from './plan';

/**
 * Desenho de um pedido de compra no formato do documento do editor de processos, com aprovação, campos por etapa,
 * decisão, caminhos em paralelo e subprocesso. Esta pasta só guarda o desenho como texto; quem confere que o editor o
 * lê e que o roteiro abaixo é o compilado dele é o teste da amostra em `processos/`.
 */
const drawing = {
  version: 2,
  lanes: [],
  graph: {
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Início',
          trigger: 'manual',
        },
      },
      {
        id: 'request',
        type: 'human-task',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Preencher o pedido',
          description: 'Reúne os dados da compra.',
          role: 'Solicitante',
          instructions: 'Informe o item, o valor e a data desejada.',
          expectedResult: 'Pedido completo.',
          dueIn: {
            amount: 2,
            unit: 'days',
          },
          fields: [
            {
              id: 'item',
              label: 'Item',
              type: 'text',
              required: true,
            },
            {
              id: 'reason',
              label: 'Justificativa',
              type: 'long-text',
              required: false,
            },
            {
              id: 'amount',
              label: 'Valor',
              type: 'number',
              required: true,
            },
            {
              id: 'wanted',
              label: 'Data desejada',
              type: 'date',
              required: false,
            },
            {
              id: 'origin',
              label: 'Origem',
              type: 'choice',
              required: true,
              options: ['Loja', 'Site'],
            },
            {
              id: 'urgent',
              label: 'Urgente',
              type: 'checkbox',
              required: false,
            },
          ],
        },
      },
      {
        id: 'approve',
        type: 'approval',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Aprovar a compra',
          description: 'Decide se a compra segue.',
          role: 'Diretoria',
          instructions: 'Confira o orçamento do mês.',
          dueIn: {
            amount: 1,
            unit: 'days',
          },
          fields: [
            {
              id: 'opinion',
              label: 'Parecer',
              type: 'long-text',
              required: true,
            },
          ],
        },
      },
      {
        id: 'high',
        type: 'decision',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Valor alto?',
          branches: [
            {
              id: 'yes',
              label: 'Sim',
              condition: 'valor > 1000',
            },
            {
              id: 'no',
              label: 'Não',
              description: 'Segue direto para o pagamento.',
            },
          ],
          defaultBranchId: 'no',
        },
      },
      {
        id: 'split',
        type: 'parallel-split',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Em paralelo',
          branches: [
            {
              id: 'quotes',
              label: 'Cotações',
            },
            {
              id: 'budget',
              label: 'Orçamento',
            },
          ],
        },
      },
      {
        id: 'quote',
        type: 'task',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Pedir cotações',
        },
      },
      {
        id: 'reserve',
        type: 'task',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Reservar o orçamento',
        },
      },
      {
        id: 'join',
        type: 'parallel-join',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Juntar',
          pairId: 'split',
        },
      },
      {
        id: 'merge',
        type: 'merge',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Seguir para o pagamento',
        },
      },
      {
        id: 'payment',
        type: 'subprocess',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Pagamento',
          goal: 'Pagar o fornecedor',
          process: {
            nodes: [
              {
                id: 'pay-start',
                type: 'start',
                position: {
                  x: 0,
                  y: 0,
                },
                data: {
                  label: 'Início',
                },
              },
              {
                id: 'pay-check',
                type: 'task',
                position: {
                  x: 0,
                  y: 0,
                },
                data: {
                  label: 'Conferir os dados',
                },
              },
              {
                id: 'pay-end',
                type: 'end',
                position: {
                  x: 0,
                  y: 0,
                },
                data: {
                  label: 'Fim',
                  outcome: 'completed',
                },
              },
            ],
            edges: [
              {
                id: 'pay-start-out-pay-check',
                source: 'pay-start',
                target: 'pay-check',
                sourceHandle: 'out',
                targetHandle: 'in',
              },
              {
                id: 'pay-check-out-pay-end',
                source: 'pay-check',
                target: 'pay-end',
                sourceHandle: 'out',
                targetHandle: 'in',
              },
            ],
          },
        },
      },
      {
        id: 'end',
        type: 'end',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Compra feita',
          outcome: 'completed',
        },
      },
      {
        id: 'refused',
        type: 'end',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          label: 'Compra recusada',
          outcome: 'rejected',
        },
      },
    ],
    edges: [
      {
        id: 'start-out-request',
        source: 'start',
        target: 'request',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'request-out-approve',
        source: 'request',
        target: 'approve',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'approve-approved-high',
        source: 'approve',
        target: 'high',
        sourceHandle: 'approved',
        targetHandle: 'in',
      },
      {
        id: 'approve-rejected-refused',
        source: 'approve',
        target: 'refused',
        sourceHandle: 'rejected',
        targetHandle: 'in',
      },
      {
        id: 'high-yes-split',
        source: 'high',
        target: 'split',
        sourceHandle: 'yes',
        targetHandle: 'in',
      },
      {
        id: 'high-no-merge',
        source: 'high',
        target: 'merge',
        sourceHandle: 'no',
        targetHandle: 'in',
      },
      {
        id: 'split-quotes-quote',
        source: 'split',
        target: 'quote',
        sourceHandle: 'quotes',
        targetHandle: 'in',
      },
      {
        id: 'split-budget-reserve',
        source: 'split',
        target: 'reserve',
        sourceHandle: 'budget',
        targetHandle: 'in',
      },
      {
        id: 'quote-out-join',
        source: 'quote',
        target: 'join',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'reserve-out-join',
        source: 'reserve',
        target: 'join',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'join-out-merge',
        source: 'join',
        target: 'merge',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'merge-out-payment',
        source: 'merge',
        target: 'payment',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
      {
        id: 'payment-out-end',
        source: 'payment',
        target: 'end',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
    ],
  },
};

/** Texto do desenho como foi publicado. */
export const SAMPLE_PUBLISHED_TEXT = JSON.stringify(drawing);

/** Texto do rascunho: o desenho publicado com a primeira etapa renomeada, ainda por publicar. */
export const SAMPLE_DRAFT_TEXT = SAMPLE_PUBLISHED_TEXT.replace(
  '"Preencher o pedido"',
  '"Preencher o pedido de compra"',
);

/** Roteiro compilado do desenho publicado. */
export const samplePlan: ProcessPlan = {
  startId: 'start',
  steps: [
    {
      id: 'start',
      kind: 'start',
      label: 'Início',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'request',
        },
      ],
      details: [
        {
          label: 'Gatilho',
          value: 'Manual',
        },
      ],
    },
    {
      id: 'request',
      kind: 'human-task',
      label: 'Preencher o pedido',
      description: 'Reúne os dados da compra.',
      role: 'Solicitante',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'approve',
        },
      ],
      instructions: 'Informe o item, o valor e a data desejada.',
      expectedResult: 'Pedido completo.',
      dueIn: {
        amount: 2,
        unit: 'days',
      },
      fields: [
        {
          id: 'item',
          label: 'Item',
          type: 'text',
          required: true,
        },
        {
          id: 'reason',
          label: 'Justificativa',
          type: 'long-text',
          required: false,
        },
        {
          id: 'amount',
          label: 'Valor',
          type: 'number',
          required: true,
        },
        {
          id: 'wanted',
          label: 'Data desejada',
          type: 'date',
          required: false,
        },
        {
          id: 'origin',
          label: 'Origem',
          type: 'choice',
          required: true,
          options: ['Loja', 'Site'],
        },
        {
          id: 'urgent',
          label: 'Urgente',
          type: 'checkbox',
          required: false,
        },
      ],
    },
    {
      id: 'approve',
      kind: 'approval',
      label: 'Aprovar a compra',
      description: 'Decide se a compra segue.',
      role: 'Diretoria',
      exits: [
        {
          id: 'approved',
          meaning: 'approved',
          label: 'Aprovado',
          to: 'high',
        },
        {
          id: 'rejected',
          meaning: 'rejected',
          label: 'Rejeitado',
          to: 'refused',
        },
      ],
      instructions: 'Confira o orçamento do mês.',
      dueIn: {
        amount: 1,
        unit: 'days',
      },
      fields: [
        {
          id: 'opinion',
          label: 'Parecer',
          type: 'long-text',
          required: true,
        },
      ],
    },
    {
      id: 'high',
      kind: 'decision',
      label: 'Valor alto?',
      exits: [
        {
          id: 'yes',
          meaning: 'branch',
          label: 'Sim',
          condition: 'valor > 1000',
          to: 'split',
        },
        {
          id: 'no',
          meaning: 'branch',
          label: 'Não',
          description: 'Segue direto para o pagamento.',
          to: 'merge',
        },
      ],
      defaultExitId: 'no',
    },
    {
      id: 'split',
      kind: 'parallel-split',
      label: 'Em paralelo',
      exits: [
        {
          id: 'quotes',
          meaning: 'branch',
          label: 'Cotações',
          to: 'quote',
        },
        {
          id: 'budget',
          meaning: 'branch',
          label: 'Orçamento',
          to: 'reserve',
        },
      ],
    },
    {
      id: 'quote',
      kind: 'task',
      label: 'Pedir cotações',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'join',
        },
      ],
    },
    {
      id: 'reserve',
      kind: 'task',
      label: 'Reservar o orçamento',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'join',
        },
      ],
    },
    {
      id: 'join',
      kind: 'parallel-join',
      label: 'Juntar',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'merge',
        },
      ],
    },
    {
      id: 'merge',
      kind: 'merge',
      label: 'Seguir para o pagamento',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'payment',
        },
      ],
    },
    {
      id: 'payment',
      kind: 'subprocess',
      label: 'Pagamento',
      exits: [
        {
          id: 'out',
          meaning: 'next',
          to: 'end',
        },
      ],
      details: [
        {
          label: 'Objetivo',
          value: 'Pagar o fornecedor',
        },
      ],
      inner: {
        startId: 'pay-start',
        steps: [
          {
            id: 'pay-start',
            kind: 'start',
            label: 'Início',
            exits: [
              {
                id: 'out',
                meaning: 'next',
                to: 'pay-check',
              },
            ],
            details: [
              {
                label: 'Gatilho',
                value: 'Manual',
              },
            ],
          },
          {
            id: 'pay-check',
            kind: 'task',
            label: 'Conferir os dados',
            exits: [
              {
                id: 'out',
                meaning: 'next',
                to: 'pay-end',
              },
            ],
          },
          {
            id: 'pay-end',
            kind: 'end',
            label: 'Fim',
            exits: [],
            outcome: {
              kind: 'completed',
              label: 'Concluído',
            },
          },
        ],
      },
    },
    {
      id: 'end',
      kind: 'end',
      label: 'Compra feita',
      exits: [],
      outcome: {
        kind: 'completed',
        label: 'Concluído',
      },
    },
    {
      id: 'refused',
      kind: 'end',
      label: 'Compra recusada',
      exits: [],
      outcome: {
        kind: 'rejected',
        label: 'Recusado',
      },
    },
  ],
};
