import {
  exitKey,
  isWithin,
  type PlanStep,
  type ProcessPlan,
  planAt,
  scopeOf,
  stepAt,
  stepRefOf,
  stepRefPath,
  stepTrail,
} from './plan';

interface StepParams {
  readonly id: string;
  readonly inner?: ProcessPlan;
}

function step({ id, inner }: StepParams): PlanStep {
  return {
    id,
    kind: inner ? 'subprocess' : 'task',
    label: id,
    exits: [],
    inner,
  };
}

const check: PlanStep = step({ id: 'check' });
const review: PlanStep = step({
  id: 'review',
  inner: { startId: 'check', steps: [check] },
});
const billing: PlanStep = step({
  id: 'billing',
  inner: { startId: 'review', steps: [review] },
});
const open: PlanStep = step({ id: 'open' });
const plan: ProcessPlan = { startId: 'open', steps: [open, billing] };

describe('stepRefOf', () => {
  it('usa o próprio id na raiz', () => {
    expect(stepRefOf({ id: 'open' })).toBe('open');
  });

  it('prefixa o endereço do subprocesso', () => {
    expect(stepRefOf({ scope: 'billing/review', id: 'check' })).toBe(
      'billing/review/check',
    );
  });
});

describe('stepRefPath', () => {
  it('devolve os ids do caminho, do mais externo até a etapa', () => {
    expect(stepRefPath('billing/review/check')).toEqual([
      'billing',
      'review',
      'check',
    ]);
    expect(stepRefPath('open')).toEqual(['open']);
  });
});

describe('scopeOf', () => {
  it('devolve o endereço do subprocesso que contém a etapa', () => {
    expect(scopeOf('billing/review/check')).toBe('billing/review');
  });

  it('devolve undefined para a etapa da raiz', () => {
    expect(scopeOf('open')).toBeUndefined();
  });
});

describe('isWithin', () => {
  it('reconhece a etapa de dentro do subprocesso, em qualquer profundidade', () => {
    expect(isWithin({ stepRef: 'billing/review', scope: 'billing' })).toBe(
      true,
    );
    expect(
      isWithin({ stepRef: 'billing/review/check', scope: 'billing' }),
    ).toBe(true);
  });

  it('não conta o próprio subprocesso nem outro de id parecido', () => {
    expect(isWithin({ stepRef: 'billing', scope: 'billing' })).toBe(false);
    expect(isWithin({ stepRef: 'billing-2/x', scope: 'billing' })).toBe(false);
  });
});

describe('stepTrail', () => {
  it('devolve só a etapa quando ela é da raiz', () => {
    expect(stepTrail({ plan, stepRef: 'open' })).toEqual([open]);
  });

  it('devolve os subprocessos do caminho antes da etapa', () => {
    expect(stepTrail({ plan, stepRef: 'billing/review/check' })).toEqual([
      billing,
      review,
      check,
    ]);
  });

  it('devolve undefined quando um id do caminho não existe', () => {
    expect(stepTrail({ plan, stepRef: 'billing/ghost' })).toBeUndefined();
  });

  it('devolve undefined quando o caminho entra numa etapa sem processo interno', () => {
    expect(stepTrail({ plan, stepRef: 'open/check' })).toBeUndefined();
  });
});

describe('stepAt', () => {
  it('acha a etapa da raiz', () => {
    expect(stepAt({ plan, stepRef: 'billing' })).toBe(billing);
  });

  it('acha a etapa dentro de subprocesso', () => {
    expect(stepAt({ plan, stepRef: 'billing/review/check' })).toBe(check);
  });

  it('devolve undefined para o endereço que não existe', () => {
    expect(stepAt({ plan, stepRef: 'ghost' })).toBeUndefined();
  });
});

describe('planAt', () => {
  it('devolve o roteiro da raiz sem subprocesso', () => {
    expect(planAt({ plan })).toBe(plan);
  });

  it('devolve o processo interno do subprocesso', () => {
    expect(planAt({ plan, scope: 'billing/review' })).toBe(review.inner);
  });

  it('devolve undefined quando o endereço não é de um subprocesso com processo interno', () => {
    expect(planAt({ plan, scope: 'open' })).toBeUndefined();
    expect(planAt({ plan, scope: 'ghost' })).toBeUndefined();
  });
});

describe('exitKey', () => {
  it('junta o endereço da etapa e o id da saída', () => {
    expect(exitKey({ stepRef: 'billing/review', exitId: 'out' })).toBe(
      'billing/review:out',
    );
  });
});
