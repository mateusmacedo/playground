import {
  depart,
  endPath,
  type Flow,
  openFlow,
  record,
  rest,
  withoutTokens,
} from './engine-flow';
import {
  ACTED_AT,
  begin,
  end,
  placeAt,
  planOf,
  STARTED_AT,
  step,
  subprocess,
} from './engine-test-kit';
import type { RunEvent } from './run';

const DEAD_END = { kind: 'other', label: 'Caminho sem continuação' } as const;
const REFUSED = { kind: 'rejected', label: 'Recusado' } as const;

// work > sub[check > close] > end; `lost` aponta para uma etapa que o nível não tem.
const plan = planOf([
  step({ id: 'work', to: 'sub' }),
  subprocess({
    id: 'sub',
    to: 'end',
    inner: [step({ id: 'check', to: 'close' }), end({ id: 'close' })],
  }),
  step({ id: 'lost', to: 'ghost' }),
  end({ id: 'end' }),
]);

const work = placeAt({ plan, stepRef: 'work' });
const sub = placeAt({ plan, stepRef: 'sub' });
const check = placeAt({ plan, stepRef: 'sub/check' });
const close = placeAt({ plan, stepRef: 'sub/close' });
const lost = placeAt({ plan, stepRef: 'lost' });

/** Estado de trabalho de um avanço sobre a execução que acabou de começar. */
function opened(): Flow {
  return openFlow({ plan, run: begin(plan), at: ACTED_AT });
}

describe('openFlow', () => {
  it('parte das fichas, do contador e das saídas da execução, sem nada em trânsito', () => {
    const run = begin(plan);

    const flow = openFlow({ plan, run, at: ACTED_AT });

    expect(flow).toEqual({
      plan,
      at: ACTED_AT,
      tokens: [{ id: 'token-1', stepRef: 'work', since: STARTED_AT }],
      nextToken: 2,
      events: [],
      takenExits: [],
      outcome: DEAD_END,
      arrivals: [],
    });
    expect(flow.tokens).toBe(run.tokens);
  });
});

describe('record', () => {
  it('acrescenta a entrada no fim do log do avanço, sem mudar o estado recebido', () => {
    const first: RunEvent = { at: ACTED_AT, kind: 'step', label: 'work' };
    const second: RunEvent = { at: ACTED_AT, kind: 'event', label: 'work' };
    const flow = opened();

    const once = record({ flow, event: first });
    const twice = record({ flow: once, event: second });

    expect(flow.events).toEqual([]);
    expect(twice.events).toEqual([first, second]);
  });
});

describe('withoutTokens', () => {
  it('tira só as fichas indicadas', () => {
    const flow = rest({ flow: opened(), place: check });

    const kept = withoutTokens({
      flow,
      gone: (token) => token.stepRef === 'work',
    });

    expect(kept.tokens.map((token) => token.stepRef)).toEqual(['sub/check']);
    expect(flow.tokens).toHaveLength(2);
  });
});

describe('rest', () => {
  it('para uma ficha nova na etapa, com o instante do avanço, e avança o contador', () => {
    const flow = rest({ flow: opened(), place: check });

    expect(flow.tokens.at(-1)).toEqual({
      id: 'token-2',
      stepRef: 'sub/check',
      since: ACTED_AT,
    });
    expect(flow.nextToken).toBe(3);
  });

  it('marca a ficha em espera numa junção ou de escopo', () => {
    const waiting = rest({
      flow: opened(),
      place: work,
      mark: { waiting: true },
    });
    const scope = rest({ flow: opened(), place: sub, mark: { scope: true } });

    expect(waiting.tokens.at(-1)).toMatchObject({ waiting: true });
    expect(scope.tokens.at(-1)).toMatchObject({ stepRef: 'sub', scope: true });
  });
});

describe('endPath', () => {
  it('na raiz, registra o caminho encerrado e guarda o desfecho', () => {
    const flow = endPath({ flow: opened(), place: work, outcome: REFUSED });

    expect(flow.outcome).toEqual(REFUSED);
    expect(flow.events).toEqual([
      {
        at: ACTED_AT,
        kind: 'path-ended',
        stepRef: 'work',
        label: 'work',
        detail: 'Recusado',
      },
    ]);
  });

  it('dentro de um subprocesso, registra o caminho encerrado sem mudar o desfecho', () => {
    const flow = endPath({ flow: opened(), place: close, outcome: REFUSED });

    expect(flow.outcome).toEqual(DEAD_END);
    expect(flow.events).toMatchObject([
      { kind: 'path-ended', stepRef: 'sub/close', detail: 'Recusado' },
    ]);
  });
});

describe('depart', () => {
  it('marca a saída como percorrida e põe a ficha a caminho do destino', () => {
    const flow = depart({
      flow: opened(),
      place: work,
      way: work.step.exits[0],
    });

    expect(flow.takenExits).toEqual(['work:out']);
    expect(flow.arrivals).toEqual([sub]);
    expect(flow.events).toEqual([]);
  });

  it('o destino fica no nível da etapa de onde a ficha sai', () => {
    const flow = depart({
      flow: opened(),
      place: check,
      way: check.step.exits[0],
    });

    expect(flow.takenExits).toEqual(['sub/check:out']);
    expect(flow.arrivals).toEqual([close]);
  });

  it('não repete a saída já percorrida', () => {
    const way = work.step.exits[0];
    const once = depart({ flow: opened(), place: work, way });

    const twice = depart({ flow: once, place: work, way });

    expect(twice.takenExits).toEqual(['work:out']);
    expect(twice.arrivals).toEqual([sub, sub]);
  });

  it('sem caminho, encerra o caminho na etapa e não marca saída', () => {
    const flow = depart({ flow: opened(), place: work });

    expect(flow.takenExits).toEqual([]);
    expect(flow.arrivals).toEqual([]);
    expect(flow.outcome).toEqual(DEAD_END);
    expect(flow.events).toMatchObject([
      {
        kind: 'path-ended',
        stepRef: 'work',
        detail: 'Caminho sem continuação',
      },
    ]);
  });

  it('com destino fora do nível, marca a saída e encerra o caminho', () => {
    const flow = depart({
      flow: opened(),
      place: lost,
      way: lost.step.exits[0],
    });

    expect(flow.takenExits).toEqual(['lost:out']);
    expect(flow.arrivals).toEqual([]);
    expect(flow.events).toMatchObject([
      { kind: 'path-ended', stepRef: 'lost' },
    ]);
  });
});
