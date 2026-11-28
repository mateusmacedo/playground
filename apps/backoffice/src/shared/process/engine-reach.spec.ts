import { canReach, reachableFrom } from './engine-reach';
import {
  branching,
  end,
  exception,
  placeAt,
  planOf,
  step,
  subprocess,
} from './engine-test-kit';

// start > work > pick > (again > work | done > end); work tem a exceção boom > fix > end; alone não liga a nada.
const plan = planOf([
  step({ id: 'start', kind: 'start', to: 'work' }),
  step({
    id: 'work',
    to: 'pick',
    data: { events: [exception({ id: 'boom', to: 'fix' })] },
  }),
  branching({
    id: 'pick',
    kind: 'decision',
    branches: { again: 'work', done: 'end', lost: 'ghost', open: undefined },
  }),
  step({ id: 'fix', to: 'end' }),
  step({ id: 'alone' }),
  subprocess({
    id: 'sub',
    to: 'end',
    inner: [step({ id: 'check', to: 'close' }), end({ id: 'close' })],
  }),
  end({ id: 'end' }),
]);

function refsFrom(stepRef: string): readonly string[] {
  const from = placeAt({ plan, stepRef });
  return reachableFrom(from).map((place) => place.stepRef);
}

const start = placeAt({ plan, stepRef: 'start' });
const fix = placeAt({ plan, stepRef: 'fix' });
const pick = placeAt({ plan, stepRef: 'pick' });

describe('reachableFrom', () => {
  it('segue as saídas até o fim do nível', () => {
    expect(refsFrom('fix')).toEqual(['end']);
  });

  it('segue também as exceções presas às etapas do caminho', () => {
    expect([...refsFrom('start')].sort()).toEqual([
      'end',
      'fix',
      'pick',
      'work',
    ]);
  });

  it('inclui a etapa de partida quando um laço volta a ela', () => {
    expect(refsFrom('work')).toContain('work');
    expect(refsFrom('fix')).not.toContain('fix');
  });

  it('ignora a saída sem destino e a que aponta para fora do nível', () => {
    expect([...refsFrom('pick')].sort()).toEqual([
      'end',
      'fix',
      'pick',
      'work',
    ]);
  });

  it('não alcança nada a partir da etapa sem destino nem do Fim', () => {
    expect(refsFrom('alone')).toEqual([]);
    expect(refsFrom('end')).toEqual([]);
  });

  it('fica no nível da etapa: não entra no subprocesso nem sai dele', () => {
    expect(refsFrom('sub')).toEqual(['end']);
    expect(refsFrom('sub/check')).toEqual(['sub/close']);
  });
});

describe('canReach', () => {
  it('diz se a ficha ainda chega à etapa', () => {
    expect(canReach({ from: start, to: 'fix' })).toBe(true);
    expect(canReach({ from: fix, to: 'work' })).toBe(false);
  });

  it('não considera a própria etapa alcançada sem um laço', () => {
    expect(canReach({ from: fix, to: 'fix' })).toBe(false);
    expect(canReach({ from: pick, to: 'pick' })).toBe(true);
  });
});
