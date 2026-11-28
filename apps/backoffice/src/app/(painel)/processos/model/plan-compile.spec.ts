import type { StepField } from '@/shared/process/fields';
import type { PlanStep } from '@/shared/process/plan';
import { parsePlan } from '@/shared/process/plan-parse';
import type { BlockData, Graph, GraphEdge, GraphNode } from './blocks';
import { DOCUMENT_VERSION, type Lane, type ProcessDocument } from './document';
import { compilePlan } from './plan-compile';
import { sampleProcess } from './sample-process';
import { block, decisionBranches, link } from './test-graph';

interface DrawingParams {
  readonly nodes: readonly GraphNode[];
  readonly edges?: readonly GraphEdge[];
  readonly lanes?: readonly Lane[];
}

function drawing(params: DrawingParams): ProcessDocument {
  const { nodes, edges = [], lanes = [] } = params;
  return { version: DOCUMENT_VERSION, lanes, graph: { nodes, edges } };
}

const start = block({ id: 'start', type: 'start' });

interface StepOfParams extends DrawingParams {
  readonly id: string;
}

/** Etapa `id` do roteiro de um desenho que começa com um Início além dos blocos dados. */
function stepOf(params: StepOfParams): PlanStep | undefined {
  const { id, nodes, edges, lanes } = params;
  const document = drawing({ nodes: [start, ...nodes], edges, lanes });
  return compilePlan(document).steps.find((step) => step.id === id);
}

/** Etapa do bloco num desenho que só tem o Início e ele. */
function compiled(node: GraphNode): PlanStep | undefined {
  return stepOf({ id: node.id, nodes: [node] });
}

interface AttachedParams {
  readonly id: string;
  readonly parentId: string;
  readonly data?: Partial<BlockData>;
}

/** Evento de exceção preso ao bloco `parentId`. */
function exception({ id, parentId, data }: AttachedParams): GraphNode {
  return { ...block({ id, type: 'exception', data }), parentId };
}

const finance: Lane = { id: 'lane-finance', name: 'Financeiro', width: 256 };

const fields: readonly StepField[] = [
  { id: 'amount', label: 'Valor aprovado', type: 'number', required: true },
  {
    id: 'origin',
    label: 'Origem do pedido',
    type: 'choice',
    required: false,
    options: ['Loja', 'Site'],
  },
];

const paymentProcess: Graph = {
  nodes: [
    block({ id: 'pay-start', type: 'start' }),
    block({ id: 'pay-check', type: 'task', data: { label: 'Conferir' } }),
    block({ id: 'pay-end', type: 'end', data: { outcome: 'completed' } }),
  ],
  edges: [
    link({ source: 'pay-start', target: 'pay-check' }),
    link({ source: 'pay-check', target: 'pay-end' }),
  ],
};

/** Pedido de compra: análise com prazo e exceção, decisão, subprocesso, mensagem, espera e temporizador. */
const purchase: ProcessDocument = drawing({
  lanes: [finance],
  nodes: [
    block({
      id: 'start',
      type: 'start',
      data: {
        trigger: 'schedule',
        schedule: { recurrence: 'daily', time: '09:00' },
      },
    }),
    block({
      id: 'review',
      type: 'human-task',
      data: {
        label: 'Analisar pedido',
        description: 'Confere o pedido de compra.',
        laneId: finance.id,
        instructions: 'Compare com o orçamento.',
        expectedResult: 'Pedido analisado.',
        dueIn: { amount: 2, unit: 'days' },
        fields,
      },
    }),
    exception({
      id: 'late',
      parentId: 'review',
      data: {
        label: 'Análise atrasada',
        exceptionTrigger: 'timeout',
        timeout: { amount: 3, unit: 'days' },
        interrupting: false,
      },
    }),
    block({
      id: 'approved',
      type: 'decision',
      data: {
        branches: [
          { id: 'yes', label: 'Sim', condition: 'valor <= 1000' },
          { id: 'no', label: 'Não', description: 'Acima do limite.' },
        ],
        defaultBranchId: 'no',
      },
    }),
    block({
      id: 'payment',
      type: 'subprocess',
      data: { goal: 'Pagar o fornecedor', process: paymentProcess },
    }),
    block({
      id: 'notify',
      type: 'send-message',
      data: { recipient: 'Solicitante', channel: 'email', content: 'Recusa' },
    }),
    block({
      id: 'delivery',
      type: 'wait-event',
      data: { eventName: 'Entrega', deadline: { amount: 2, unit: 'weeks' } },
    }),
    block({
      id: 'cooling',
      type: 'timer',
      data: { timerMode: 'until', until: '2026-12-01T09:00' },
    }),
    block({ id: 'note', type: 'annotation' }),
    block({
      id: 'end',
      type: 'end',
      data: { outcome: 'other', outcomeLabel: 'Compra encerrada' },
    }),
  ],
  edges: [
    link({ source: 'start', target: 'review' }),
    link({ source: 'review', target: 'approved' }),
    link({ source: 'late', target: 'notify' }),
    link({ source: 'approved', target: 'payment', sourceHandle: 'yes' }),
    link({ source: 'approved', target: 'notify', sourceHandle: 'no' }),
    link({ source: 'payment', target: 'delivery' }),
    link({ source: 'notify', target: 'end' }),
    link({ source: 'delivery', target: 'cooling', sourceHandle: 'received' }),
    link({ source: 'delivery', target: 'end', sourceHandle: 'expired' }),
    link({ source: 'cooling', target: 'end' }),
  ],
});

function purchaseStep(id: string): PlanStep | undefined {
  return compilePlan(purchase).steps.find((step) => step.id === id);
}

describe('compilePlan', () => {
  it('compila o processo de exemplo do Início ao Fim', () => {
    const plan = compilePlan(drawing(sampleProcess));

    expect(plan).toEqual({
      startId: 'start',
      steps: [
        {
          id: 'start',
          kind: 'start',
          label: 'Início',
          details: [{ label: 'Gatilho', value: 'Manual' }],
          exits: [{ id: 'out', meaning: 'next', to: 'task-1' }],
        },
        {
          id: 'task-1',
          kind: 'task',
          label: 'Primeira etapa',
          description: 'Descreva a atividade.',
          exits: [{ id: 'out', meaning: 'next', to: 'end' }],
        },
        {
          id: 'end',
          kind: 'end',
          label: 'Fim',
          exits: [],
          outcome: { kind: 'completed', label: 'Concluído' },
        },
      ],
    });
  });

  it('dá a cada etapa o id do bloco, na ordem do desenho', () => {
    const plan = compilePlan(purchase);

    expect(plan.startId).toBe('start');
    expect(plan.steps.map((step) => step.id)).toEqual([
      'start',
      'review',
      'approved',
      'payment',
      'notify',
      'delivery',
      'cooling',
      'end',
    ]);
  });

  it('gera um roteiro que a leitura do armazenamento devolve igual', () => {
    const plan = compilePlan(purchase);
    const stored: unknown = JSON.parse(JSON.stringify(plan));

    expect(parsePlan(stored)).toEqual(plan);
  });

  it('devolve um roteiro sem etapas quando o desenho não tem Início', () => {
    const document = drawing({ nodes: [block({ id: 'a', type: 'task' })] });

    expect(compilePlan(document)).toEqual({ startId: '', steps: [] });
  });

  it('começa pelo primeiro Início quando o desenho tem mais de um', () => {
    const second = block({ id: 'second', type: 'start' });

    const plan = compilePlan(drawing({ nodes: [start, second] }));

    expect(plan.startId).toBe('start');
    expect(plan.steps.map((step) => step.id)).toEqual(['start', 'second']);
  });

  it('deixa a anotação fora do roteiro', () => {
    expect(compiled(block({ id: 'note', type: 'annotation' }))).toBeUndefined();
  });

  describe('Início', () => {
    it('assume o gatilho manual quando nenhum foi escolhido', () => {
      const plan = compilePlan(drawing({ nodes: [start] }));

      expect(plan.steps).toEqual([
        {
          id: 'start',
          kind: 'start',
          label: 'start',
          details: [{ label: 'Gatilho', value: 'Manual' }],
          exits: [{ id: 'out', meaning: 'next' }],
        },
      ]);
    });

    it('descreve o agendamento do gatilho por agendamento', () => {
      expect(purchaseStep('start')?.details).toEqual([
        { label: 'Gatilho', value: 'Por agendamento' },
        { label: 'Agendamento', value: 'Todos os dias às 09:00' },
      ]);
    });

    it('leva a mensagem do gatilho por mensagem', () => {
      const data = { trigger: 'message', triggerMessage: 'Pedido' } as const;
      const byMessage = block({ id: 'start', type: 'start', data });

      const plan = compilePlan(drawing({ nodes: [byMessage] }));

      expect(plan.steps[0]?.details).toEqual([
        { label: 'Gatilho', value: 'Por mensagem' },
        { label: 'Mensagem que inicia', value: 'Pedido' },
      ]);
    });

    it('ignora o agendamento incompleto e o dado de outro gatilho', () => {
      const incomplete = block({
        id: 'start',
        type: 'start',
        data: {
          trigger: 'schedule',
          schedule: { recurrence: 'weekly', time: '09:00' },
          triggerMessage: 'Pedido',
        },
      });

      const plan = compilePlan(drawing({ nodes: [incomplete] }));

      expect(plan.steps[0]?.details).toEqual([
        { label: 'Gatilho', value: 'Por agendamento' },
      ]);
    });
  });

  describe('atividades', () => {
    it('compila a Etapa com a descrição e os campos a preencher', () => {
      const data = { label: 'Conferir', description: ' Confere. ', fields };

      expect(compiled(block({ id: 'a', type: 'task', data }))).toEqual({
        id: 'a',
        kind: 'task',
        label: 'Conferir',
        description: 'Confere.',
        fields,
        exits: [{ id: 'out', meaning: 'next' }],
      });
    });

    it('usa o nome do tipo quando o bloco está sem título', () => {
      const untitled = block({ id: 'a', type: 'task', data: { label: ' ' } });

      expect(compiled(untitled)?.label).toBe('Etapa');
    });

    it('trata o bloco de tipo desconhecido como Etapa', () => {
      expect(compiled(block({ id: 'a', type: 'mystery' }))?.kind).toBe('task');
    });

    it('deixa a etapa sem campos quando a lista está vazia', () => {
      const plain = block({ id: 'a', type: 'task', data: { fields: [] } });

      expect(compiled(plain)?.fields).toBeUndefined();
    });

    it('compila a Tarefa humana com papel, instruções, resultado, prazo e campos', () => {
      expect(purchaseStep('review')).toEqual({
        id: 'review',
        kind: 'human-task',
        label: 'Analisar pedido',
        description: 'Confere o pedido de compra.',
        role: 'Financeiro',
        instructions: 'Compare com o orçamento.',
        expectedResult: 'Pedido analisado.',
        dueIn: { amount: 2, unit: 'days' },
        fields,
        exits: [{ id: 'out', meaning: 'next', to: 'approved' }],
        events: [
          {
            id: 'late',
            label: 'Análise atrasada',
            trigger: 'timeout',
            interrupting: false,
            timeout: { amount: 3, unit: 'days' },
            to: 'notify',
          },
        ],
      });
    });

    it('descarta o prazo que não é uma duração válida', () => {
      const data = { dueIn: { amount: 0, unit: 'days' } } as const;

      const step = compiled(block({ id: 'a', type: 'human-task', data }));

      expect(step?.dueIn).toBeUndefined();
    });

    it('compila a Aprovação com papel aprovador, instruções, prazo, campos e os dois pareceres', () => {
      const approval = block({
        id: 'ok',
        type: 'approval',
        data: {
          label: 'Aprovar compra',
          description: 'Decide a compra.',
          role: 'Diretoria',
          instructions: ' Confira o orçamento. ',
          expectedResult: 'Não é da aprovação.',
          dueIn: { amount: 1, unit: 'days' },
          fields,
        },
      });
      const done = block({ id: 'done', type: 'task' });
      const refused = block({ id: 'refused', type: 'task' });
      const edges = [
        link({ source: 'ok', target: 'done', sourceHandle: 'approved' }),
        link({ source: 'ok', target: 'refused', sourceHandle: 'rejected' }),
      ];

      const step = stepOf({
        id: 'ok',
        nodes: [approval, done, refused],
        edges,
      });

      expect(step).toEqual({
        id: 'ok',
        kind: 'approval',
        label: 'Aprovar compra',
        description: 'Decide a compra.',
        role: 'Diretoria',
        instructions: 'Confira o orçamento.',
        dueIn: { amount: 1, unit: 'days' },
        fields,
        exits: [
          {
            id: 'approved',
            meaning: 'approved',
            label: 'Aprovado',
            to: 'done',
          },
          {
            id: 'rejected',
            meaning: 'rejected',
            label: 'Rejeitado',
            to: 'refused',
          },
        ],
      });
    });

    it('gera um roteiro de Aprovação que a leitura do armazenamento aceita de volta', () => {
      const document = drawing({
        nodes: [
          start,
          block({
            id: 'ok',
            type: 'approval',
            data: { role: 'Diretoria', fields },
          }),
          block({ id: 'done', type: 'end', data: { outcome: 'completed' } }),
          block({ id: 'refused', type: 'end', data: { outcome: 'rejected' } }),
        ],
        edges: [
          link({ source: 'start', target: 'ok' }),
          link({ source: 'ok', target: 'done', sourceHandle: 'approved' }),
          link({ source: 'ok', target: 'refused', sourceHandle: 'rejected' }),
        ],
      });

      const plan = compilePlan(document);
      const stored: unknown = JSON.parse(JSON.stringify(plan));

      expect(parsePlan(stored)).toEqual(plan);
    });

    it('usa a raia como papel aprovador e leva a exceção presa à Aprovação', () => {
      const approval = block({
        id: 'ok',
        type: 'approval',
        data: { laneId: finance.id, dueIn: { amount: 0, unit: 'days' } },
      });
      const late = exception({
        id: 'late',
        parentId: 'ok',
        data: {
          exceptionTrigger: 'timeout',
          timeout: { amount: 2, unit: 'days' },
        },
      });

      const step = stepOf({
        id: 'ok',
        nodes: [approval, late],
        lanes: [finance],
      });

      expect(step).toMatchObject({
        kind: 'approval',
        role: 'Financeiro',
        exits: [
          { id: 'approved', meaning: 'approved' },
          { id: 'rejected', meaning: 'rejected' },
        ],
        events: [{ id: 'late', trigger: 'timeout', interrupting: true }],
      });
      expect(step?.dueIn).toBeUndefined();
      expect(step?.fields).toBeUndefined();
    });

    it('leva ao roteiro só o campo completo, com o nome e as opções limpos', () => {
      const data = {
        fields: [
          { id: 'a', label: ' Valor ', type: 'number', required: true },
          { id: 'b', label: '', type: 'text', required: false },
          { id: 'c', label: 'Motivo', type: 'choice', required: false },
          {
            id: 'd',
            label: 'Origem',
            type: 'choice',
            required: false,
            options: ['Loja', '', ' Site ', 'Loja'],
          },
        ],
      } as const;

      const step = compiled(block({ id: 'a', type: 'task', data }));

      expect(step?.fields).toEqual([
        { id: 'a', label: 'Valor', type: 'number', required: true },
        {
          id: 'd',
          label: 'Origem',
          type: 'choice',
          required: false,
          options: ['Loja', 'Site'],
        },
      ]);
    });

    it('lista só os dados preenchidos da Tarefa automatizada', () => {
      const data = { system: 'ERP', operation: ' ', inputs: 'Pedido' };

      const step = compiled(block({ id: 'a', type: 'automated-task', data }));

      expect(step?.details).toEqual([
        { label: 'Sistema', value: 'ERP' },
        { label: 'Entradas', value: 'Pedido' },
      ]);
    });

    it('deixa a etapa sem dados quando nenhum foi preenchido', () => {
      const step = compiled(block({ id: 'a', type: 'automated-task' }));

      expect(step?.details).toBeUndefined();
    });

    it('dá o nome do canal nos dados de Enviar mensagem', () => {
      expect(purchaseStep('notify')?.details).toEqual([
        { label: 'Destinatário', value: 'Solicitante' },
        { label: 'Canal', value: 'E-mail' },
        { label: 'Conteúdo ou modelo', value: 'Recusa' },
      ]);
    });

    it('omite o canal da mensagem que ainda não tem um', () => {
      const data = { recipient: 'Solicitante' };

      const step = compiled(block({ id: 'a', type: 'send-message', data }));

      expect(step?.details).toEqual([
        { label: 'Destinatário', value: 'Solicitante' },
      ]);
    });
  });

  describe('Aguardar evento', () => {
    it('sem prazo, só tem a saída de evento recebido', () => {
      const data = { eventName: 'Entrega' };

      expect(compiled(block({ id: 'a', type: 'wait-event', data }))).toEqual({
        id: 'a',
        kind: 'wait-event',
        label: 'a',
        details: [{ label: 'Evento aguardado', value: 'Entrega' }],
        exits: [
          { id: 'received', meaning: 'received', label: 'Evento recebido' },
        ],
      });
    });

    it('com prazo, ganha a saída de prazo expirado', () => {
      const received = { id: 'received', meaning: 'received', to: 'cooling' };
      const expired = { id: 'expired', meaning: 'expired', to: 'end' };

      expect(purchaseStep('delivery')).toMatchObject({
        deadline: { amount: 2, unit: 'weeks' },
        exits: [
          { ...received, label: 'Evento recebido' },
          { ...expired, label: 'Prazo expirado' },
        ],
      });
    });
  });

  describe('Temporizador', () => {
    it('espera a duração quando o modo é por duração', () => {
      const duration = { amount: 4, unit: 'hours' } as const;
      const data = { duration, until: '2026-12-01T09:00' };

      expect(compiled(block({ id: 'a', type: 'timer', data }))).toEqual({
        id: 'a',
        kind: 'timer',
        label: 'a',
        duration,
        exits: [{ id: 'out', meaning: 'next' }],
      });
    });

    it('espera até a data e o horário quando o modo é esse', () => {
      expect(purchaseStep('cooling')).toEqual({
        id: 'cooling',
        kind: 'timer',
        label: 'cooling',
        until: '2026-12-01T09:00',
        exits: [{ id: 'out', meaning: 'next', to: 'end' }],
      });
    });

    it('descarta a data e o horário fora do formato', () => {
      const data = { timerMode: 'until', until: 'amanhã' } as const;

      const step = compiled(block({ id: 'a', type: 'timer', data }));

      expect(step?.until).toBeUndefined();
    });
  });

  describe('desvios', () => {
    it('dá à Decisão uma saída por ramo, com condição, explicação e destino', () => {
      const yes = { id: 'yes', meaning: 'branch', label: 'Sim' };
      const no = { id: 'no', meaning: 'branch', label: 'Não' };

      expect(purchaseStep('approved')).toEqual({
        id: 'approved',
        kind: 'decision',
        label: 'approved',
        defaultExitId: 'no',
        exits: [
          { ...yes, condition: 'valor <= 1000', to: 'payment' },
          { ...no, description: 'Acima do limite.', to: 'notify' },
        ],
      });
    });

    it('descarta o caminho padrão que não é mais um ramo', () => {
      const data = { branches: decisionBranches, defaultBranchId: 'gone' };

      const step = compiled(block({ id: 'a', type: 'decision', data }));

      expect(step?.defaultExitId).toBeUndefined();
    });

    it('deixa a Decisão sem ramos sem saída nenhuma', () => {
      expect(compiled(block({ id: 'a', type: 'decision' }))?.exits).toEqual([]);
    });

    it('leva o caminho padrão da Decisão inclusiva', () => {
      const data = { branches: decisionBranches, defaultBranchId: 'yes' };

      const step = compiled(block({ id: 'a', type: 'inclusive-split', data }));

      expect(step?.defaultExitId).toBe('yes');
    });

    it('dá à Abertura paralela uma saída por ramo, sem caminho padrão', () => {
      const data = { branches: decisionBranches, defaultBranchId: 'yes' };

      expect(
        compiled(block({ id: 'a', type: 'parallel-split', data })),
      ).toEqual({
        id: 'a',
        kind: 'parallel-split',
        label: 'a',
        exits: [
          { id: 'yes', meaning: 'branch', label: 'Sim' },
          { id: 'no', meaning: 'branch', label: 'Não' },
        ],
      });
    });

    it.each(['merge', 'inclusive-join', 'parallel-join'] as const)(
      'dá a %s uma saída única de sequência',
      (kind) => {
        const nodes = [
          block({ id: 'a', type: kind }),
          block({ id: 'b', type: 'task' }),
        ];
        const edges = [link({ source: 'a', target: 'b' })];

        expect(stepOf({ id: 'a', nodes, edges })).toEqual({
          id: 'a',
          kind,
          label: 'a',
          exits: [{ id: 'out', meaning: 'next', to: 'b' }],
        });
      },
    );
  });

  describe('saídas', () => {
    const task = block({ id: 'a', type: 'task' });
    const next = block({ id: 'b', type: 'task' });

    it('deixa sem destino a saída que não tem conexão', () => {
      expect(compiled(task)?.exits).toEqual([{ id: 'out', meaning: 'next' }]);
    });

    it('deixa sem destino a conexão que leva a um bloco que não existe', () => {
      const edges = [link({ source: 'a', target: 'gone' })];

      const step = stepOf({ id: 'a', nodes: [task], edges });

      expect(step?.exits[0]?.to).toBeUndefined();
    });

    it('deixa sem destino a conexão que leva a um bloco que não é etapa', () => {
      const note = block({ id: 'note', type: 'annotation' });
      const edges = [link({ source: 'a', target: 'note' })];

      const step = stepOf({ id: 'a', nodes: [task, note], edges });

      expect(step?.exits[0]?.to).toBeUndefined();
    });

    it('conta a conexão sem ponto de saída como a da saída única', () => {
      const edge: GraphEdge = { id: 'a-b', source: 'a', target: 'b' };

      const step = stepOf({ id: 'a', nodes: [task, next], edges: [edge] });

      expect(step?.exits[0]?.to).toBe('b');
    });
  });

  describe('exceção', () => {
    const task = block({ id: 'task', type: 'automated-task' });
    const fallback = block({ id: 'fallback', type: 'task' });
    const failure = exception({ id: 'failure', parentId: 'task' });

    it('vira evento da etapa a que está presa, e não uma etapa', () => {
      const nodes = [task, failure, fallback];
      const edges = [link({ source: 'failure', target: 'fallback' })];
      const event = { id: 'failure', label: 'failure', trigger: 'error' };

      expect(stepOf({ id: 'task', nodes, edges })?.events).toEqual([
        { ...event, interrupting: true, to: 'fallback' },
      ]);
      expect(stepOf({ id: 'failure', nodes, edges })).toBeUndefined();
    });

    it('leva o tempo limite só quando o gatilho é tempo esgotado', () => {
      const timeout = { amount: 1, unit: 'hours' } as const;
      const byTime = exception({
        id: 'by-time',
        parentId: 'task',
        data: { exceptionTrigger: 'timeout', timeout },
      });
      const byError = exception({
        id: 'by-error',
        parentId: 'task',
        data: { exceptionTrigger: 'error', timeout },
      });

      const step = stepOf({ id: 'task', nodes: [task, byTime, byError] });

      expect(step?.events?.map((event) => event.timeout)).toEqual([
        timeout,
        undefined,
      ]);
    });

    it('fica só na etapa a que está presa', () => {
      const nodes = [task, failure, fallback];

      expect(stepOf({ id: 'fallback', nodes })?.events).toBeUndefined();
    });

    it('some do roteiro quando está presa a um bloco que não existe', () => {
      const loose = exception({ id: 'loose', parentId: 'gone' });

      const plan = compilePlan(drawing({ nodes: [start, task, loose] }));

      expect(plan.steps.map((step) => step.id)).toEqual(['start', 'task']);
      expect(plan.steps[1]?.events).toBeUndefined();
    });
  });

  describe('papel', () => {
    it('prefere o papel do bloco ao nome da raia', () => {
      const data = { role: 'Comprador', laneId: finance.id };
      const nodes = [block({ id: 'a', type: 'human-task', data })];

      expect(stepOf({ id: 'a', nodes, lanes: [finance] })?.role).toBe(
        'Comprador',
      );
    });

    it('usa o nome da raia quando o bloco não tem papel', () => {
      const nodes = [
        block({ id: 'a', type: 'task', data: { laneId: finance.id } }),
      ];

      expect(stepOf({ id: 'a', nodes, lanes: [finance] })?.role).toBe(
        'Financeiro',
      );
    });

    it('fica sem papel quando a raia do bloco não existe mais', () => {
      const nodes = [
        block({ id: 'a', type: 'task', data: { laneId: 'gone' } }),
      ];

      expect(
        stepOf({ id: 'a', nodes, lanes: [finance] })?.role,
      ).toBeUndefined();
    });
  });

  describe('Subprocesso', () => {
    interface ParentParams {
      readonly process?: Graph;
      readonly data?: Partial<BlockData>;
    }

    function parent({ process, data }: ParentParams): GraphNode {
      const own = { ...data, process };
      return block({ id: 'parent', type: 'subprocess', data: own });
    }

    it('compila o canvas interno como o roteiro da etapa', () => {
      const out = { id: 'out', meaning: 'next' };

      expect(purchaseStep('payment')).toEqual({
        id: 'payment',
        kind: 'subprocess',
        label: 'payment',
        details: [{ label: 'Objetivo', value: 'Pagar o fornecedor' }],
        exits: [{ ...out, to: 'delivery' }],
        inner: {
          startId: 'pay-start',
          steps: [
            {
              id: 'pay-start',
              kind: 'start',
              label: 'pay-start',
              details: [{ label: 'Gatilho', value: 'Manual' }],
              exits: [{ ...out, to: 'pay-check' }],
            },
            {
              id: 'pay-check',
              kind: 'task',
              label: 'Conferir',
              exits: [{ ...out, to: 'pay-end' }],
            },
            {
              id: 'pay-end',
              kind: 'end',
              label: 'pay-end',
              exits: [],
              outcome: { kind: 'completed', label: 'Concluído' },
            },
          ],
        },
      });
    });

    it('compila subprocesso dentro de subprocesso', () => {
      const child = block({
        id: 'child',
        type: 'subprocess',
        data: { process: paymentProcess },
      });
      const middle: Graph = {
        nodes: [block({ id: 'middle-start', type: 'start' }), child],
        edges: [link({ source: 'middle-start', target: 'child' })],
      };

      const step = compiled(parent({ process: middle }));

      expect(step?.inner?.startId).toBe('middle-start');
      expect(step?.inner?.steps[1]?.inner?.startId).toBe('pay-start');
    });

    it('não liga a etapa interna a um bloco de outro nível', () => {
      const process: Graph = {
        nodes: [block({ id: 'inner-start', type: 'start' })],
        edges: [link({ source: 'inner-start', target: 'outside' })],
      };
      const nodes = [
        parent({ process }),
        block({ id: 'outside', type: 'task' }),
      ];

      const step = stepOf({ id: 'parent', nodes });

      expect(step?.inner?.steps[0]?.exits[0]?.to).toBeUndefined();
    });

    it('usa as raias do desenho para o papel das etapas internas', () => {
      const pay = block({
        id: 'pay',
        type: 'task',
        data: { laneId: finance.id },
      });
      const process: Graph = {
        nodes: [block({ id: 'inner-start', type: 'start' }), pay],
        edges: [],
      };
      const nodes = [parent({ process })];

      const step = stepOf({ id: 'parent', nodes, lanes: [finance] });

      expect(step?.inner?.steps[1]?.role).toBe('Financeiro');
    });

    it('fica sem roteiro interno quando o canvas interno não tem Início', () => {
      const process: Graph = {
        nodes: [block({ id: 'pay', type: 'task' })],
        edges: [],
      };
      const data = { inputs: 'Fatura', outputs: 'Comprovante' };

      expect(compiled(parent({ process, data }))).toEqual({
        id: 'parent',
        kind: 'subprocess',
        label: 'parent',
        details: [
          { label: 'Entradas', value: 'Fatura' },
          { label: 'Saídas esperadas', value: 'Comprovante' },
        ],
        exits: [{ id: 'out', meaning: 'next' }],
      });
    });

    it('fica sem roteiro interno quando não tem canvas interno', () => {
      expect(compiled(parent({}))?.inner).toBeUndefined();
    });
  });

  describe('Fim', () => {
    it.each([
      ['completed', 'Concluído'],
      ['rejected', 'Recusado'],
      ['cancelled', 'Cancelado'],
      ['expired', 'Expirado'],
    ] as const)('dá ao desfecho %s o nome %s', (outcome, label) => {
      const end = block({ id: 'end', type: 'end', data: { outcome } });

      expect(compiled(end)).toEqual({
        id: 'end',
        kind: 'end',
        label: 'end',
        exits: [],
        outcome: { kind: outcome, label },
      });
    });

    it('dá ao desfecho Outro o nome escolhido pelo usuário', () => {
      expect(purchaseStep('end')?.outcome).toEqual({
        kind: 'other',
        label: 'Compra encerrada',
      });
    });

    it('chama de Outro o desfecho Outro que ficou sem nome', () => {
      const data = { outcome: 'other', outcomeLabel: ' ' } as const;

      const step = compiled(block({ id: 'end', type: 'end', data }));

      expect(step?.outcome).toEqual({ kind: 'other', label: 'Outro' });
    });

    it('fica sem desfecho quando nenhum foi escolhido', () => {
      const step = compiled(block({ id: 'end', type: 'end' }));

      expect(step?.outcome).toBeUndefined();
    });
  });
});
