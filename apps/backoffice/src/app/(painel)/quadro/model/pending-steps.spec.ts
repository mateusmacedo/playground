import {
  act,
  begin,
  end,
  planOf,
  step,
  tokenAt,
} from '@/shared/process/engine-test-kit';
import { linearPlan, parallelPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import type { Board, BoardCard, BoardProcess } from './board';
import { pendingSteps } from './pending-steps';
import { processBoard } from './process-test-data';

interface Flow {
  readonly process: BoardProcess;
  readonly run: ProcessRun;
}

function flow(params: {
  readonly id: string;
  readonly plan: ProcessPlan;
}): Flow {
  const { id, plan } = params;
  const process: BoardProcess = {
    definitionId: id,
    version: 1,
    name: `Processo ${id}`,
    plan,
  };
  return { process, run: { ...begin(plan), definitionId: id } };
}

function dueStepPlan(params: {
  readonly amount: number;
  readonly unit: 'hours' | 'days';
}): ProcessPlan {
  return planOf([
    step({ id: 'start', kind: 'start', to: 'a' }),
    step({
      id: 'a',
      to: 'end',
      data: { dueIn: params, role: 'Analista', label: 'Analisar' },
    }),
    end({ id: 'end' }),
  ]);
}

const soon = flow({
  id: 'soon',
  plan: dueStepPlan({ amount: 1, unit: 'hours' }),
});
const later = flow({
  id: 'later',
  plan: dueStepPlan({ amount: 2, unit: 'days' }),
});
const linear = flow({ id: 'linear', plan: linearPlan });
const parallelRun = (() => {
  const started = flow({ id: 'par', plan: parallelPlan });
  const tokenId = tokenAt({ run: started.run, stepRef: 'a' }).id;
  const run = act({
    plan: parallelPlan,
    run: started.run,
    action: { kind: 'complete', tokenId },
  });
  return { process: started.process, run };
})();

function stepsBoard(): Board {
  const delegatedRun: ProcessRun = {
    ...linear.run,
    tokens: linear.run.tokens.map((token) => ({
      ...token,
      delegateId: 'child',
    })),
  };
  const cards: BoardCard[] = [
    { id: 'lin', title: 'Linear', assigneeId: 'ana', process: delegatedRun },
    { id: 'par', title: 'Paralelo', process: parallelRun.run },
    { id: 'later', title: 'Depois', assigneeId: 'ana', process: later.run },
    {
      id: 'lost',
      title: 'Sem roteiro',
      process: { ...linear.run, definitionId: 'x' },
    },
    { id: 'child', title: 'Filho', assigneeId: 'bia', parentId: 'lin' },
  ];
  const board = processBoard({
    todo: cards,
    doing: [{ id: 'soon', title: 'Logo', process: soon.run }],
    processes: [
      soon.process,
      later.process,
      linear.process,
      parallelRun.process,
    ],
  });
  return {
    ...board,
    config: {
      ...board.config,
      people: [
        { id: 'ana', name: 'Ana' },
        { id: 'bia', name: 'Bia' },
      ],
    },
  };
}

describe('pendingSteps', () => {
  it('lista as etapas à espera de ação, da que vence primeiro para as sem prazo', () => {
    const steps = pendingSteps({ board: stepsBoard() });
    expect(steps.map((item) => `${item.card.id}:${item.label}`)).toEqual([
      'soon:Analisar',
      'later:Analisar',
      'lin:a',
      'par:b',
    ]);
  });

  it('traz a coluna, o tipo, o papel, o prazo e o responsável de cada etapa', () => {
    const [first, second] = pendingSteps({ board: stepsBoard() });
    expect(first).toMatchObject({
      lane: { id: 'doing' },
      kind: 'task',
      role: 'Analista',
      since: '2026-11-26T10:00:00.000Z',
      dueAt: '2026-11-26T11:00:00.000Z',
      overdue: false,
    });
    expect(first?.assignee).toBeUndefined();
    expect(second?.assignee).toBe('Ana');
  });

  it('dá o responsável do card filho quando a etapa foi entregue a ele', () => {
    const delegated = pendingSteps({ board: stepsBoard() }).find(
      (item) => item.card.id === 'lin',
    );
    expect(delegated?.delegate?.id).toBe('child');
    expect(delegated?.assignee).toBe('Bia');
  });

  it('marca como atrasada a etapa cujo prazo passou do instante da consulta', () => {
    const steps = pendingSteps({
      board: stepsBoard(),
      now: '2026-11-26T12:00:00.000Z',
    });
    expect(steps.map((item) => item.overdue)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('desempata pelo tempo de espera e depois pela ordem do quadro', () => {
    const waitedLess: ProcessRun = {
      ...linear.run,
      tokens: linear.run.tokens.map((token) => ({
        ...token,
        since: '2026-11-26T11:30:00.000Z',
      })),
    };
    const board = processBoard({
      todo: [
        { id: 'new', title: 'Novo', process: waitedLess },
        { id: 'old', title: 'Antigo', process: linear.run },
        { id: 'old2', title: 'Antigo 2', process: linear.run },
      ],
      processes: [linear.process],
    });
    const steps = pendingSteps({ board });
    expect(steps.map((item) => item.card.id)).toEqual(['old', 'old2', 'new']);
  });

  it('passa à frente a etapa com prazo que vem depois no quadro', () => {
    const board = processBoard({
      todo: [
        { id: 'free', title: 'Sem prazo', process: linear.run },
        { id: 'due', title: 'Com prazo', process: later.run },
      ],
      processes: [linear.process, later.process],
    });
    const steps = pendingSteps({ board });
    expect(steps.map((item) => item.card.id)).toEqual(['due', 'free']);
  });
});
