import { type BoardRun, boardRunsOf, sortRuns } from './board-runs';
import {
  deliveryPlan,
  deliveryRun,
  storedPlan,
  testBoard,
} from './board-runs-test-kit';
import {
  begin,
  end,
  planOf,
  resolve,
  STARTED_AT,
  step,
  subprocess,
} from './engine-test-kit';
import { parallelPlan } from './engine-test-plans';
import type { ProcessPlan } from './plan';
import type { ProcessRun } from './run';

/** Meia hora depois do início: dentro do prazo de 1 hora de "Separar". */
const IN_TIME = '2026-11-26T10:30:00.000Z';
/** Duas horas depois do início: o prazo de "Separar" já passou. */
const LATE = '2026-11-26T12:00:00.000Z';

interface RunsParams {
  readonly process: ProcessRun;
  readonly plan?: ProcessPlan;
  readonly at?: string;
}

/** As execuções de um quadro com um card só, o `QD-7 Atender o pedido`. */
function runsOf(params: RunsParams): readonly BoardRun[] {
  const { process, plan = deliveryPlan, at = IN_TIME } = params;
  const card = { id: 'card-1', number: 7, title: 'Atender o pedido', process };
  return boardRunsOf({
    boardId: 'board-1',
    boardName: 'Quadro principal',
    board: testBoard({ cards: [card], processes: [storedPlan(plan)] }),
    at,
  });
}

function onlyRun(params: RunsParams): BoardRun {
  const [run] = runsOf(params);
  if (run === undefined) {
    throw new Error('Nenhuma execução lida.');
  }
  return run;
}

describe('boardRunsOf', () => {
  it('descreve a execução em andamento: processo, card, quadro, etapa, progresso e início', () => {
    const process = deliveryRun({ name: 'Atendimento', version: 1 });

    expect(runsOf({ process })).toEqual([
      {
        ref: { boardId: 'board-1', cardId: 'card-1' },
        boardName: 'Quadro principal',
        cardLabel: 'QD-7 Atender o pedido',
        cardHref: '/quadro?quadro=board-1&card=QD-7',
        processName: 'Atendimento',
        version: 1,
        steps: [
          {
            tokenId: process.tokens[0]?.id,
            label: 'Separar',
            waiting: false,
            overdue: false,
          },
        ],
        progress: { done: 0, remaining: 2, total: 2 },
        startedAt: STARTED_AT,
        overdue: false,
      },
    ]);
  });

  it('conta as etapas feitas no progresso e passa à etapa seguinte', () => {
    const process = resolve({
      plan: deliveryPlan,
      run: deliveryRun(),
      stepRef: 'pick',
    });

    const run = onlyRun({ process });

    expect(run.progress).toEqual({ done: 1, remaining: 1, total: 2 });
    expect(run.steps.map((item) => item.label)).toEqual(['Entregar']);
  });

  it('marca como atrasada a etapa cujo prazo passou, e a execução junto', () => {
    const run = onlyRun({ process: deliveryRun(), at: LATE });

    expect(run.steps[0]?.overdue).toBe(true);
    expect(run.overdue).toBe(true);
  });

  it('não marca atraso na etapa sem prazo', () => {
    const process = resolve({
      plan: deliveryPlan,
      run: deliveryRun(),
      stepRef: 'pick',
    });

    const run = onlyRun({ process, at: '2027-01-01T00:00:00.000Z' });

    expect(run.steps[0]?.overdue).toBe(false);
    expect(run.overdue).toBe(false);
  });

  it('mostra como espera a etapa parada numa junção, ao lado da que ainda falta', () => {
    const process = resolve({
      plan: parallelPlan,
      run: begin(parallelPlan),
      stepRef: 'a',
    });

    const steps = onlyRun({ process, plan: parallelPlan }).steps;

    expect(steps).toHaveLength(2);
    expect(steps).toContainEqual(
      expect.objectContaining({ label: 'b', waiting: false }),
    );
    expect(steps).toContainEqual(
      expect.objectContaining({ label: 'join', waiting: true, overdue: false }),
    );
  });

  it('mostra a etapa de dentro do subprocesso com o nome dele na frente, sem linha própria para o subprocesso', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'sub' }),
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [step({ id: 'check', data: { label: 'Pesar' } })],
        data: { label: 'Conferência' },
      }),
      end({ id: 'end' }),
    ]);

    const run = onlyRun({ process: begin(plan), plan, at: LATE });

    expect(run.steps.map((item) => item.label)).toEqual([
      'Conferência › Pesar',
    ]);
    expect(run.overdue).toBe(false);
  });

  it('passa o atraso do subprocesso para a etapa de dentro dele', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'sub' }),
      subprocess({
        id: 'sub',
        to: 'end',
        inner: [step({ id: 'check', data: { label: 'Pesar' } })],
        data: { label: 'Conferência', dueIn: { amount: 1, unit: 'hours' } },
      }),
      end({ id: 'end' }),
    ]);

    expect(onlyRun({ process: begin(plan), plan }).overdue).toBe(false);
    const late = onlyRun({ process: begin(plan), plan, at: LATE });

    expect(late.steps).toEqual([
      expect.objectContaining({ label: 'Conferência › Pesar', overdue: true }),
    ]);
    expect(late.overdue).toBe(true);
  });

  it('dá um nome genérico ao processo e à etapa que vieram sem nome', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'a' }),
      step({ id: 'a', to: 'end', data: { label: '  ' } }),
      end({ id: 'end' }),
    ]);

    const run = onlyRun({ process: { ...begin(plan), name: '' }, plan });

    expect(run.processName).toBe('Processo sem nome');
    expect(run.steps[0]?.label).toBe('Etapa sem nome');
  });

  it('não devolve nada para o quadro sem execução em andamento', () => {
    const finished = deliveryRun({ status: 'completed', tokens: [] });

    expect(runsOf({ process: finished })).toEqual([]);
    expect(
      boardRunsOf({
        boardId: 'board-1',
        boardName: 'Quadro principal',
        board: undefined,
        at: IN_TIME,
      }),
    ).toEqual([]);
  });
});

describe('sortRuns', () => {
  /** Execução só com o que a ordem olha. */
  function runAt(overrides: Partial<BoardRun>): BoardRun {
    return { ...onlyRun({ process: deliveryRun() }), ...overrides };
  }

  it('põe as atrasadas primeiro e, depois, as iniciadas há mais tempo', () => {
    const recent = runAt({ startedAt: '2026-11-26T09:00:00.000Z' });
    const old = runAt({ startedAt: '2026-11-20T09:00:00.000Z' });
    const lateRecent = runAt({
      startedAt: '2026-11-25T09:00:00.000Z',
      overdue: true,
    });
    const lateOld = runAt({
      startedAt: '2026-11-22T09:00:00.000Z',
      overdue: true,
    });

    expect(sortRuns([recent, lateRecent, old, lateOld])).toEqual([
      lateOld,
      lateRecent,
      old,
      recent,
    ]);
  });

  it('mantém no empate a ordem em que as execuções vieram, sem mexer na lista recebida', () => {
    const first = runAt({ cardLabel: 'QD-1' });
    const second = runAt({ cardLabel: 'QD-2' });
    const given = [first, second];

    expect(sortRuns(given)).toEqual([first, second]);
    expect(given).toEqual([first, second]);
  });
});
