import type { PlanStep, ProcessPlan } from './plan';
import { parseOutcome, parsePlan } from './plan-parse';

/** O valor como volta do armazenamento: sem tipo e sem os campos `undefined`. */
function stored(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const start: PlanStep = {
  id: 'start',
  kind: 'start',
  label: 'Início',
  exits: [{ id: 'out', meaning: 'next', to: 'review' }],
};

const review: PlanStep = {
  id: 'review',
  kind: 'human-task',
  label: 'Analisar pedido',
  description: 'Confere os dados do pedido.',
  role: 'Analista',
  instructions: 'Abrir o cadastro.',
  expectedResult: 'Pedido conferido.',
  dueIn: { amount: 2, unit: 'days' },
  details: [{ label: 'Sistema', value: 'ERP' }],
  fields: [{ id: 'note', label: 'Parecer', type: 'text', required: true }],
  exits: [{ id: 'out', meaning: 'next', to: 'decide' }],
  events: [
    {
      id: 'late',
      label: 'Tempo esgotado',
      trigger: 'timeout',
      interrupting: true,
      timeout: { amount: 4, unit: 'hours' },
      to: 'end',
    },
  ],
};

const decide: PlanStep = {
  id: 'decide',
  kind: 'decision',
  label: 'Aprovado?',
  exits: [
    {
      id: 'yes',
      meaning: 'branch',
      label: 'Sim',
      condition: 'valor até o limite',
      description: 'Segue para a cobrança.',
      to: 'billing',
    },
    { id: 'no', meaning: 'branch', label: 'Não', to: 'end' },
  ],
  defaultExitId: 'no',
};

const billing: PlanStep = {
  id: 'billing',
  kind: 'subprocess',
  label: 'Cobrança',
  exits: [{ id: 'out', meaning: 'next', to: 'wait' }],
  inner: {
    startId: 'inner-start',
    steps: [
      {
        id: 'inner-start',
        kind: 'start',
        label: 'Início',
        exits: [{ id: 'out', meaning: 'next', to: 'inner-end' }],
      },
      {
        id: 'inner-end',
        kind: 'end',
        label: 'Fim',
        exits: [],
        outcome: { kind: 'completed', label: 'Concluído' },
      },
    ],
  },
};

const wait: PlanStep = {
  id: 'wait',
  kind: 'wait-event',
  label: 'Aguardar pagamento',
  deadline: { amount: 1, unit: 'weeks' },
  exits: [
    {
      id: 'received',
      meaning: 'received',
      label: 'Evento recebido',
      to: 'timer',
    },
    { id: 'expired', meaning: 'expired', label: 'Prazo expirado', to: 'end' },
  ],
};

const timer: PlanStep = {
  id: 'timer',
  kind: 'timer',
  label: 'Carência',
  duration: { amount: 30, unit: 'minutes' },
  until: '2026-12-01T09:00',
  exits: [{ id: 'out', meaning: 'next', to: 'end' }],
};

const end: PlanStep = {
  id: 'end',
  kind: 'end',
  label: 'Fim',
  exits: [],
  outcome: { kind: 'other', label: 'Encerrado' },
};

const plan: ProcessPlan = {
  startId: 'start',
  steps: [start, review, decide, billing, wait, timer, end],
};

interface StepChange {
  readonly id: string;
  readonly change: Readonly<Record<string, unknown>>;
}

/** O roteiro gravado com os campos de uma etapa trocados. */
function withStep({ id, change }: StepChange): unknown {
  return stored({
    ...plan,
    steps: plan.steps.map((step) =>
      step.id === id ? { ...step, ...change } : step,
    ),
  });
}

function parsedStep(params: StepChange): PlanStep | undefined {
  const parsed = parsePlan(withStep(params));
  return parsed?.steps.find((step) => step.id === params.id);
}

describe('parsePlan', () => {
  it('devolve o mesmo roteiro que foi gravado', () => {
    expect(parsePlan(stored(plan))).toEqual(plan);
  });

  it('invalida o que não é um roteiro', () => {
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan('roteiro')).toBeNull();
    expect(parsePlan({ startId: 'start' })).toBeNull();
  });

  it('invalida o roteiro cujo início não é uma etapa dele', () => {
    expect(parsePlan(stored({ ...plan, startId: 'ghost' }))).toBeNull();
    expect(parsePlan(stored({ ...plan, startId: 7 }))).toBeNull();
  });

  it('invalida o roteiro com etapa ilegível', () => {
    expect(parsePlan(stored({ ...plan, steps: [start, 'lixo'] }))).toBeNull();
    expect(parsePlan(withStep({ id: 'end', change: { id: '' } }))).toBeNull();
    expect(parsePlan(withStep({ id: 'end', change: { label: 7 } }))).toBeNull();
    expect(
      parsePlan(withStep({ id: 'end', change: { kind: 'robô' } })),
    ).toBeNull();
  });

  it('invalida o roteiro com id de etapa que contém o separador de endereço', () => {
    expect(
      parsePlan(withStep({ id: 'end', change: { id: 'a/b' } })),
    ).toBeNull();
  });

  it('invalida o roteiro com id de etapa repetido', () => {
    expect(parsePlan(stored({ ...plan, steps: [start, end, end] }))).toBeNull();
  });

  it('invalida o roteiro com saída ilegível ou repetida', () => {
    const broken: readonly unknown[] = [
      'saídas',
      ['lixo'],
      [{ meaning: 'next' }],
      [{ id: 'out', meaning: 'talvez' }],
      [
        { id: 'out', meaning: 'next' },
        { id: 'out', meaning: 'next' },
      ],
    ];
    for (const exits of broken) {
      expect(
        parsePlan(withStep({ id: 'timer', change: { exits } })),
      ).toBeNull();
    }
  });

  it('descarta o destino de saída que não é etapa do nível', () => {
    const step = parsedStep({
      id: 'decide',
      change: {
        exits: [
          { id: 'yes', meaning: 'branch', to: 'ghost' },
          { id: 'no', meaning: 'branch', to: 'inner-end' },
          { id: 'other', meaning: 'branch', to: 'end' },
        ],
      },
    });
    expect(step?.exits.map((exit) => exit.to)).toEqual([
      undefined,
      undefined,
      'end',
    ]);
  });

  it('descarta o destino de exceção que não é etapa do nível', () => {
    const step = parsedStep({
      id: 'review',
      change: {
        events: [
          { id: 'a', label: 'Erro', trigger: 'error', to: 'ghost' },
          { id: 'b', label: 'Erro', trigger: 'error', to: 'end' },
        ],
      },
    });
    expect(step?.events?.map((event) => event.to)).toEqual([undefined, 'end']);
  });

  it('descarta a exceção ilegível sem perder as outras', () => {
    const step = parsedStep({
      id: 'review',
      change: {
        events: [
          'lixo',
          { label: 'Sem id', trigger: 'error' },
          { id: 'a', label: 7, trigger: 'error' },
          { id: 'b', label: 'Gatilho desconhecido', trigger: 'raio' },
          { id: 'c', label: 'Erro técnico', trigger: 'error' },
        ],
      },
    });
    expect(step?.events).toEqual([
      { id: 'c', label: 'Erro técnico', trigger: 'error', interrupting: false },
    ]);
  });

  it('só trata como interrupção a exceção gravada com true', () => {
    const step = parsedStep({
      id: 'review',
      change: {
        events: [
          { id: 'a', label: 'A', trigger: 'error', interrupting: 'sim' },
          { id: 'b', label: 'B', trigger: 'error', interrupting: true },
        ],
      },
    });
    expect(step?.events?.map((event) => event.interrupting)).toEqual([
      false,
      true,
    ]);
  });

  it('descarta a duração fora do formato', () => {
    const broken: readonly unknown[] = [
      '2 dias',
      { amount: 0, unit: 'days' },
      { amount: 1.5, unit: 'days' },
      { amount: 2, unit: 'meses' },
    ];
    for (const dueIn of broken) {
      const step = parsedStep({ id: 'review', change: { dueIn } });
      expect(step?.dueIn).toBeUndefined();
    }
  });

  it('descarta os dados opcionais fora do formato sem perder a etapa', () => {
    const step = parsedStep({
      id: 'timer',
      change: {
        description: '   ',
        role: 7,
        until: 'amanhã',
        details: [{ label: 'Sistema', value: '' }, 'lixo'],
        fields: [{ id: 'a', label: 'A', type: 'arquivo' }],
        defaultExitId: 'ghost',
        outcome: { kind: 'sumiu', label: 'X' },
      },
    });
    expect(step).toEqual({
      id: 'timer',
      kind: 'timer',
      label: 'Carência',
      duration: { amount: 30, unit: 'minutes' },
      exits: [{ id: 'out', meaning: 'next', to: 'end' }],
    });
  });

  it('descarta o processo interno ilegível e mantém o subprocesso', () => {
    const step = parsedStep({
      id: 'billing',
      change: { inner: { startId: 'ghost', steps: [] } },
    });
    expect(step?.kind).toBe('subprocess');
    expect(step?.inner).toBeUndefined();
  });
});

describe('parseOutcome', () => {
  it('lê o desfecho com tipo conhecido e nome', () => {
    expect(parseOutcome({ kind: 'rejected', label: 'Recusado' })).toEqual({
      kind: 'rejected',
      label: 'Recusado',
    });
  });

  it('devolve undefined para o desfecho ilegível', () => {
    expect(parseOutcome(undefined)).toBeUndefined();
    expect(parseOutcome({ kind: 'rejected' })).toBeUndefined();
    expect(parseOutcome({ kind: 'sumiu', label: 'X' })).toBeUndefined();
  });
});
