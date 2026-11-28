import {
  ACTED_AT,
  begin,
  branching,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
  subprocess,
  tokenRefs,
} from './engine-test-kit';
import type { ProcessRun } from './run';

const APPROVED = { kind: 'completed', label: 'Aprovado' } as const;
const DENIED = { kind: 'rejected', label: 'Negado' } as const;

describe('subprocesso', () => {
  const inner = [
    step({ id: 'begin', kind: 'start', to: 'check' }),
    step({ id: 'check', to: 'finish' }),
    end({ id: 'finish', outcome: DENIED }),
  ];
  const plan = planOf([
    step({ id: 'start', kind: 'start', to: 'sub' }),
    subprocess({ id: 'sub', to: 'after', inner }),
    step({ id: 'after', to: 'end' }),
    end({ id: 'end', outcome: APPROVED }),
  ]);

  it('ao entrar, a ficha vira ficha de escopo e nasce uma ficha no início interno', () => {
    const run = begin(plan);

    expect(run.tokens).toEqual([
      { id: 'token-1', stepRef: 'sub', since: STARTED_AT, scope: true },
      { id: 'token-2', stepRef: 'sub/check', since: STARTED_AT },
    ]);
    expect(run.takenExits).toEqual(['start:out', 'sub/begin:out']);
  });

  it('sem ficha interna, a ficha de escopo segue pela saída do bloco', () => {
    const run = resolve({ plan, run: begin(plan), stepRef: 'sub/check' });

    expect(run.tokens).toEqual([
      { id: 'token-3', stepRef: 'after', since: ACTED_AT },
    ]);
    expect(run.takenExits).toContain('sub:out');
    expect(run.log.slice(-2)).toEqual([
      {
        at: ACTED_AT,
        kind: 'path-ended',
        stepRef: 'sub/finish',
        label: 'finish',
        detail: 'Negado',
      },
      {
        at: ACTED_AT,
        kind: 'step',
        stepRef: 'sub',
        label: 'sub',
        detail: 'Subprocesso concluído',
      },
    ]);
  });

  it('o Fim interno não define o desfecho da execução', () => {
    const inside = resolve({ plan, run: begin(plan), stepRef: 'sub/check' });
    const run = resolve({ plan, run: inside, stepRef: 'after' });

    expect(inside.status).toBe('running');
    expect(run.outcome).toEqual(APPROVED);
  });

  it('o subprocesso continua em andamento enquanto resta ficha interna', () => {
    const forked = planOf([
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [
          branching({
            id: 'split',
            kind: 'parallel-split',
            branches: { left: 'a', right: 'b' },
          }),
          step({ id: 'a' }),
          step({ id: 'b' }),
        ],
      }),
      end({ id: 'end' }),
    ]);

    const run = resolve({ plan: forked, run: begin(forked), stepRef: 'sub/a' });

    expect(tokenRefs(run)).toEqual(['sub', 'sub/b']);
    expect(run.status).toBe('running');
  });

  it('o subprocesso sem processo interno válido espera uma conclusão simples', () => {
    const broken = planOf([
      subprocess({
        id: 'sub',
        to: 'end',
        inner,
        data: { inner: { startId: 'ghost', steps: inner } },
      }),
      end({ id: 'end' }),
    ]);

    const run = begin(broken);
    const done = resolve({ plan: broken, run, stepRef: 'sub' });

    expect(run.tokens).toEqual([
      { id: 'token-1', stepRef: 'sub', since: STARTED_AT },
    ]);
    expect(done.status).toBe('completed');
  });

  it('o subprocesso que termina sem etapa de espera é atravessado de uma vez', () => {
    const quick = planOf([
      subprocess({
        id: 'sub',
        to: 'after',
        inner: [step({ id: 'begin', kind: 'start' })],
      }),
      step({ id: 'after' }),
    ]);

    const run = begin(quick);

    expect(tokenRefs(run)).toEqual(['after']);
    expect(run.log.map((event) => event.kind)).toEqual([
      'started',
      'path-ended',
      'step',
    ]);
  });

  it('o subprocesso dentro de subprocesso endereça as etapas pelo caminho inteiro', () => {
    const deep = planOf([
      subprocess({
        id: 'outer',
        to: 'end',
        inner: [
          subprocess({
            id: 'inner',
            to: 'last',
            inner: [step({ id: 'check' })],
          }),
          step({ id: 'last' }),
        ],
      }),
      end({ id: 'end' }),
    ]);

    const run = begin(deep);
    const up = resolve({ plan: deep, run, stepRef: 'outer/inner/check' });
    const done = resolve({ plan: deep, run: up, stepRef: 'outer/last' });

    expect(tokenRefs(run)).toEqual([
      'outer',
      'outer/inner',
      'outer/inner/check',
    ]);
    expect(tokenRefs(up)).toEqual(['outer', 'outer/last']);
    expect(done.status).toBe('completed');
    expect(done.outcome).toEqual({ kind: 'completed', label: 'Concluído' });
  });

  it('deixa onde está a ficha de escopo parada fora do roteiro', () => {
    const stray = { id: 'token-8', stepRef: 'ghost', since: STARTED_AT };
    const started = begin(plan);
    const run: ProcessRun = {
      ...started,
      tokens: [...started.tokens, { ...stray, scope: true }],
    };

    const moved = resolve({ plan, run, stepRef: 'sub/check' });

    expect(tokenRefs(moved)).toEqual(['ghost', 'after']);
  });
});
