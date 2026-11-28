import {
  appendLog,
  type ProcessRun,
  parseRun,
  RUN_LOG_LIMIT,
  type RunEvent,
} from './run';

/** O valor como volta do armazenamento: sem tipo e sem os campos `undefined`. */
function stored(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const STARTED_AT = '2026-11-26T10:00:00.000Z';
const MOVED_AT = '2026-11-26T10:05:00.000Z';

const run: ProcessRun = {
  definitionId: 'process-1',
  version: 2,
  name: 'Atendimento',
  status: 'running',
  startedAt: STARTED_AT,
  tokens: [
    {
      id: 'token-2',
      stepRef: 'billing',
      since: MOVED_AT,
      scope: true,
    },
    {
      id: 'token-3',
      stepRef: 'billing/charge',
      since: MOVED_AT,
      delegateId: 'card-9',
    },
    {
      id: 'token-4',
      stepRef: 'join',
      since: '2026-11-26T10:06:00.000Z',
      waiting: true,
    },
  ],
  log: [
    { at: STARTED_AT, kind: 'started', label: 'Atendimento' },
    {
      at: MOVED_AT,
      kind: 'step',
      stepRef: 'review',
      label: 'Analisar pedido',
      detail: 'antes do previsto',
      note: 'Tudo certo.',
      by: 'Ana',
      values: [{ label: 'Parecer', value: 'Aprovado' }],
    },
  ],
  nextToken: 5,
  takenExits: ['start:out', 'review:out'],
};

const finished: ProcessRun = {
  ...run,
  status: 'completed',
  endedAt: '2026-11-26T11:00:00.000Z',
  tokens: [],
  outcome: { kind: 'completed', label: 'Concluído' },
};

function event(index: number): RunEvent {
  return {
    at: STARTED_AT,
    kind: index === 0 ? 'started' : 'step',
    label: `Entrada ${index}`,
  };
}

function events(count: number): RunEvent[] {
  return Array.from({ length: count }, (_, index) => event(index));
}

describe('parseRun', () => {
  it('devolve a mesma execução em andamento que foi gravada', () => {
    expect(parseRun(stored(run))).toEqual(run);
  });

  it('devolve a mesma execução encerrada que foi gravada', () => {
    expect(parseRun(stored(finished))).toEqual(finished);
  });

  it('invalida o que não é uma execução', () => {
    expect(parseRun(undefined)).toBeUndefined();
    expect(parseRun('execução')).toBeUndefined();
  });

  it('invalida a execução com identificação ou situação ilegível', () => {
    const broken: readonly Readonly<Record<string, unknown>>[] = [
      { definitionId: ' ' },
      { version: 0 },
      { name: 7 },
      { status: 'pausada' },
      { startedAt: 'ontem' },
      { nextToken: -1 },
    ];
    for (const change of broken) {
      expect(parseRun(stored({ ...run, ...change }))).toBeUndefined();
    }
  });

  it('invalida a execução com ficha ilegível', () => {
    const [token] = run.tokens;
    const broken: readonly unknown[] = [
      'fichas',
      ['lixo'],
      [{ ...token, id: '' }],
      [{ ...token, stepRef: ' ' }],
      [{ ...token, since: 'agora' }],
    ];
    for (const tokens of broken) {
      expect(parseRun(stored({ ...run, tokens }))).toBeUndefined();
    }
  });

  it('invalida a execução com id de ficha repetido', () => {
    const [token] = run.tokens;
    expect(
      parseRun(stored({ ...run, tokens: [token, token] })),
    ).toBeUndefined();
  });

  it('só marca a ficha como em espera ou de escopo quando gravada com true', () => {
    const [token] = run.tokens;
    const parsed = parseRun(
      stored({
        ...run,
        tokens: [{ ...token, waiting: 'sim', scope: 1, delegateId: ' ' }],
      }),
    );
    expect(parsed?.tokens).toEqual([
      { id: 'token-2', stepRef: 'billing', since: token?.since },
    ]);
  });

  it('descarta o fim e o desfecho fora do formato', () => {
    const parsed = parseRun(
      stored({ ...finished, endedAt: 'depois', outcome: { kind: 'sumiu' } }),
    );
    expect(parsed?.endedAt).toBeUndefined();
    expect(parsed?.outcome).toBeUndefined();
  });

  it('descarta a entrada de log ilegível sem perder as outras', () => {
    const [first] = run.log;
    const parsed = parseRun(
      stored({
        ...run,
        log: [
          first,
          'lixo',
          { ...first, at: 'ontem' },
          { ...first, label: 7 },
          { ...first, kind: 'sumiu' },
          { ...first, kind: 'finished', values: ['lixo'], by: ' ' },
        ],
      }),
    );
    expect(parsed?.log).toEqual([first, { ...first, kind: 'finished' }]);
  });

  it('começa com o log e as saídas percorridas vazios quando não vieram', () => {
    const parsed = parseRun(
      stored({ ...run, log: undefined, takenExits: 'todas' }),
    );
    expect(parsed?.log).toEqual([]);
    expect(parsed?.takenExits).toEqual([]);
  });

  it('descarta a saída percorrida ilegível ou repetida', () => {
    const parsed = parseRun(
      stored({ ...run, takenExits: ['start:out', 7, '', 'start:out', 'a:b'] }),
    );
    expect(parsed?.takenExits).toEqual(['start:out', 'a:b']);
  });

  it('traz o log gravado acima do limite de volta ao limite', () => {
    const log = events(RUN_LOG_LIMIT + 5);
    const parsed = parseRun(stored({ ...run, log }));
    expect(parsed?.log).toHaveLength(RUN_LOG_LIMIT);
    expect(parsed?.log.at(0)).toEqual(log.at(0));
    expect(parsed?.log.at(-1)).toEqual(log.at(-1));
  });
});

describe('appendLog', () => {
  it('limita o log a 300 entradas', () => {
    expect(RUN_LOG_LIMIT).toBe(300);
  });

  it('põe os eventos novos no fim', () => {
    const log = events(2);
    const added = event(2);
    expect(appendLog({ log, events: [added] })).toEqual([...log, added]);
  });

  it('mantém o log inteiro quando ele chega exatamente ao limite', () => {
    const log = events(RUN_LOG_LIMIT - 1);
    const result = appendLog({ log, events: [event(RUN_LOG_LIMIT - 1)] });
    expect(result).toHaveLength(RUN_LOG_LIMIT);
    expect(result.at(1)).toEqual(log.at(1));
  });

  it('ao passar do limite, descarta as mais antigas depois da primeira', () => {
    const log = events(RUN_LOG_LIMIT);
    const added = [event(RUN_LOG_LIMIT), event(RUN_LOG_LIMIT + 1)];
    const result = appendLog({ log, events: added });
    expect(result).toHaveLength(RUN_LOG_LIMIT);
    expect(result.at(0)).toEqual(log.at(0));
    expect(result.at(1)).toEqual(log.at(3));
    expect(result.slice(-2)).toEqual(added);
  });
});
