import {
  ACTED_AT,
  begin,
  branching,
  end,
  planOf,
  resolve,
  step,
  tokenRefs,
} from './engine-test-kit';
import type { PlanStep } from './plan';

const DEAD_END = { kind: 'other', label: 'Caminho sem continuação' } as const;
const APPROVED = { kind: 'completed', label: 'Aprovado' } as const;
const DENIED = { kind: 'rejected', label: 'Negado' } as const;

describe('fim de caminho', () => {
  const twoEnds = planOf([
    step({ id: 'start', kind: 'start', to: 'split' }),
    branching({
      id: 'split',
      kind: 'parallel-split',
      branches: { left: 'a', right: 'b' },
    }),
    step({ id: 'a', to: 'approved' }),
    step({ id: 'b', to: 'denied' }),
    end({ id: 'approved', outcome: APPROVED }),
    end({ id: 'denied', outcome: DENIED }),
  ]);

  it('o Fim consome a ficha e registra o caminho encerrado, sem encerrar a execução', () => {
    const run = resolve({ plan: twoEnds, run: begin(twoEnds), stepRef: 'a' });

    expect(run.status).toBe('running');
    expect(run.outcome).toBeUndefined();
    expect(tokenRefs(run)).toEqual(['b']);
    expect(run.log.at(-1)).toEqual({
      at: ACTED_AT,
      kind: 'path-ended',
      stepRef: 'approved',
      label: 'approved',
      detail: 'Aprovado',
    });
  });

  it('sem fichas, a execução termina com o desfecho do último Fim alcançado', () => {
    const first = resolve({ plan: twoEnds, run: begin(twoEnds), stepRef: 'a' });
    const at = '2026-11-26T15:00:00.000Z';

    const run = resolve({ plan: twoEnds, run: first, stepRef: 'b', at });

    expect(run).toMatchObject({
      status: 'completed',
      endedAt: at,
      outcome: DENIED,
      tokens: [],
    });
    expect(run.log.slice(-2)).toEqual([
      {
        at,
        kind: 'path-ended',
        stepRef: 'denied',
        label: 'denied',
        detail: 'Negado',
      },
      { at, kind: 'finished', label: 'Processo concluído', detail: 'Negado' },
    ]);
  });

  it('o Fim sem desfecho declarado vale como concluído', () => {
    const plan = planOf([step({ id: 'work', to: 'end' }), end({ id: 'end' })]);

    const run = resolve({ plan, run: begin(plan), stepRef: 'work' });

    expect(run.outcome).toEqual({ kind: 'completed', label: 'Concluído' });
  });

  it('a saída sem destino encerra o caminho como um Fim de desfecho "outro"', () => {
    const plan = planOf([step({ id: 'work' })]);

    const run = resolve({ plan, run: begin(plan), stepRef: 'work' });

    expect(run.status).toBe('completed');
    expect(run.outcome).toEqual(DEAD_END);
    expect(run.takenExits).toEqual(['work:out']);
    expect(run.log.slice(-2)).toMatchObject([
      {
        kind: 'path-ended',
        stepRef: 'work',
        label: 'work',
        detail: 'Caminho sem continuação',
      },
      { kind: 'finished', detail: 'Caminho sem continuação' },
    ]);
  });

  it('a saída para uma etapa que o nível não tem encerra o caminho', () => {
    const plan = planOf([step({ id: 'work', to: 'ghost' })]);

    const run = resolve({ plan, run: begin(plan), stepRef: 'work' });

    expect(run.outcome).toEqual(DEAD_END);
    expect(run.takenExits).toEqual(['work:out']);
  });

  it('a etapa sem nenhuma saída encerra o caminho ao ser concluída', () => {
    const plan = planOf([step({ id: 'work', data: { exits: [] } })]);

    const run = resolve({ plan, run: begin(plan), stepRef: 'work' });

    expect(run.outcome).toEqual(DEAD_END);
    expect(run.takenExits).toEqual([]);
  });

  it('a etapa automática sem saída encerra o caminho na chegada', () => {
    const start = step({ id: 'start', kind: 'start', data: { exits: [] } });
    const split = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({ id: 'split', kind: 'parallel-split', branches: {} }),
    ]);

    const stopped = begin(planOf([start]));
    const unsplit = begin(split);

    expect(stopped.outcome).toEqual(DEAD_END);
    expect(unsplit.outcome).toEqual(DEAD_END);
    expect(unsplit.log.at(-2)).toMatchObject({
      kind: 'path-ended',
      stepRef: 'split',
    });
  });

  it('a escolha sem nenhuma saída para escolher encerra o caminho na chegada', () => {
    const empty = planOf([
      branching({ id: 'pick', kind: 'decision', branches: {} }),
    ]);
    const onlyExpired: PlanStep = {
      id: 'wait',
      kind: 'wait-event',
      label: 'wait',
      exits: [{ id: 'expired', meaning: 'expired', to: 'pick' }],
    };

    const undecided = begin(empty);
    const unanswered = begin(planOf([onlyExpired]));

    expect(undecided.outcome).toEqual(DEAD_END);
    expect(unanswered.outcome).toEqual(DEAD_END);
  });

  it('o caminho que termina por último define o desfecho, mesmo sem chegar a um Fim', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'split' }),
      branching({
        id: 'split',
        kind: 'parallel-split',
        branches: { left: 'a', right: 'b' },
      }),
      step({ id: 'a', to: 'approved' }),
      step({ id: 'b' }),
      end({ id: 'approved', outcome: APPROVED }),
    ]);

    const first = resolve({ plan, run: begin(plan), stepRef: 'a' });
    const run = resolve({ plan, run: first, stepRef: 'b' });

    expect(run.outcome).toEqual(DEAD_END);
  });
});
