import { advance } from './engine';
import {
  ACTED_AT,
  act,
  begin,
  branching,
  resolve,
  STARTED_AT,
  step,
  tokenAt,
  tokenRefs,
} from './engine-test-kit';
import {
  nestedPlan,
  parallelPlan,
  planAround,
  reviewFields,
  stoppedAt,
} from './engine-test-plans';
import type { StepKind } from './plan';
import type { ProcessRun } from './run';

const NOT_ACTIONABLE = {
  ok: false,
  refusal: {
    code: 'not-actionable',
    message: 'Esta etapa não espera uma ação agora.',
  },
};

describe('advance com complete', () => {
  const completable: readonly StepKind[] = [
    'task',
    'human-task',
    'automated-task',
    'send-message',
    'timer',
    'subprocess',
  ];

  it.each(completable)(
    'conclui a etapa do tipo %s e segue pela saída',
    (kind) => {
      const { plan, run } = stoppedAt(step({ id: 'a', kind, to: 'done' }));

      const moved = resolve({ plan, run, stepRef: 'a' });

      expect(tokenRefs(moved)).toEqual(['done']);
      expect(moved.takenExits).toContain('a:out');
    },
  );

  it('registra a conclusão com a observação, o autor e os valores preenchidos', () => {
    const subject = step({
      id: 'a',
      to: 'done',
      data: { label: 'Analisar', fields: reviewFields },
    });
    const { plan, run, tokenId } = stoppedAt(subject);

    const moved = act({
      plan,
      run,
      action: {
        kind: 'complete',
        tokenId,
        note: ' Tudo certo. ',
        values: { opinion: 'Favorável', agreed: true },
      },
      by: 'Ana',
    });

    expect(moved.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'step',
      stepRef: 'a',
      label: 'Analisar',
      note: 'Tudo certo.',
      by: 'Ana',
      values: [
        { label: 'Parecer', value: 'Favorável' },
        { label: 'De acordo', value: 'Sim' },
      ],
    });
  });

  it('não registra observação vazia nem lista de valores vazia', () => {
    const { plan, run, tokenId } = stoppedAt(step({ id: 'a', to: 'done' }));

    const moved = act({
      plan,
      run,
      action: { kind: 'complete', tokenId, note: '   ' },
    });

    expect(moved.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'step',
      stepRef: 'a',
      label: 'a',
    });
  });

  it('recusa concluir a etapa que pede a escolha de um caminho', () => {
    const subject = branching({
      id: 'a',
      kind: 'decision',
      branches: { yes: 'done', no: 'other' },
    });
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: { kind: 'complete', tokenId },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'wrong-action',
        message: 'Esta etapa pede a escolha de um caminho.',
      },
    });
  });

  it('recusa concluir a ficha em espera numa junção', () => {
    const run = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });
    const tokenId = tokenAt({ run, stepRef: 'join' }).id;

    const result = advance({
      plan: parallelPlan,
      run,
      action: { kind: 'complete', tokenId },
      at: ACTED_AT,
    });

    expect(result).toEqual(NOT_ACTIONABLE);
  });

  it('recusa concluir o subprocesso em andamento', () => {
    const run = begin(nestedPlan);
    const tokenId = tokenAt({ run, stepRef: 'sub' }).id;

    const result = advance({
      plan: nestedPlan,
      run,
      action: { kind: 'complete', tokenId },
      at: ACTED_AT,
    });

    expect(result).toEqual(NOT_ACTIONABLE);
  });

  it('recusa concluir a ficha parada numa etapa que o motor atravessa sozinho', () => {
    const plan = planAround(step({ id: 'a', to: 'done' }));
    const run: ProcessRun = {
      ...begin(plan),
      tokens: [{ id: 'token-9', stepRef: 'start', since: STARTED_AT }],
    };

    const result = advance({
      plan,
      run,
      action: { kind: 'complete', tokenId: 'token-9' },
      at: ACTED_AT,
    });

    expect(result).toEqual(NOT_ACTIONABLE);
  });

  it('recusa o campo obrigatório vazio, com a lista dos rótulos', () => {
    const subject = step({
      id: 'a',
      to: 'done',
      data: { fields: reviewFields },
    });
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: { kind: 'complete', tokenId, values: { agreed: false } },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'missing-fields',
        message: 'Preencha os campos obrigatórios: Parecer, De acordo.',
      },
    });
  });

  it('recusa o valor que o tipo do campo não aceita', () => {
    const subject = step({
      id: 'a',
      to: 'done',
      data: { fields: reviewFields },
    });
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: {
        kind: 'complete',
        tokenId,
        values: { opinion: 'Favorável', agreed: true, amount: 'dez' },
      },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'invalid-fields',
        message: 'Corrija o valor dos campos: Valor.',
      },
    });
  });

  it('junta na mesma recusa os obrigatórios vazios e os valores inválidos', () => {
    const subject = step({
      id: 'a',
      to: 'done',
      data: { fields: reviewFields },
    });
    const { plan, run, tokenId } = stoppedAt(subject);

    const result = advance({
      plan,
      run,
      action: {
        kind: 'complete',
        tokenId,
        values: { agreed: true, amount: 'dez' },
      },
      at: ACTED_AT,
    });

    expect(result).toEqual({
      ok: false,
      refusal: {
        code: 'missing-fields',
        message:
          'Preencha os campos obrigatórios: Parecer. Corrija o valor dos campos: Valor.',
      },
    });
  });

  it('registra "antes do previsto" ao concluir o temporizador antes da hora', () => {
    const duration = { amount: 2, unit: 'hours' } as const;
    const subject = step({
      id: 'a',
      kind: 'timer',
      to: 'done',
      data: { duration },
    });
    const { plan, run } = stoppedAt(subject);

    const early = resolve({ plan, run, stepRef: 'a', at: ACTED_AT });
    const onTime = resolve({
      plan,
      run,
      stepRef: 'a',
      at: '2026-11-26T12:00:00.000Z',
    });

    expect(early.log.at(-1)?.detail).toBe('antes do previsto');
    expect(onTime.log.at(-1)?.detail).toBeUndefined();
  });

  it('não registra "antes do previsto" na tarefa concluída dentro do prazo', () => {
    const dueIn = { amount: 2, unit: 'days' } as const;
    const { plan, run } = stoppedAt(
      step({ id: 'a', to: 'done', data: { dueIn } }),
    );

    const moved = resolve({ plan, run, stepRef: 'a' });

    expect(moved.log.at(-1)?.detail).toBeUndefined();
  });
});
