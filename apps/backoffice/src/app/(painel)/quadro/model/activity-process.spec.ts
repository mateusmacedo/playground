import {
  act,
  begin,
  branching,
  end,
  planOf,
  step,
  tokenAt,
} from '@/shared/process/engine-test-kit';
import { linearPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import { appendActivity } from './activity';
import { isProcessActivity, processChanges } from './activity-process';
import { activityText } from './activity-text';
import type { BoardCard, CardActivity } from './board';
import { CHANGED_AT } from './process-test-data';

const card: BoardCard = { id: 'a', title: 'A' };

function withRun(process: ProcessRun | undefined): BoardCard {
  return { ...card, process };
}

interface ResolveParams {
  readonly plan: ProcessPlan;
  readonly run: ProcessRun;
  readonly stepRef: string;
}

function completeAt(params: ResolveParams): ProcessRun {
  const { plan, run, stepRef } = params;
  const tokenId = tokenAt({ run, stepRef }).id;
  return act({ plan, run, action: { kind: 'complete', tokenId } });
}

describe('processChanges', () => {
  const run = begin(linearPlan);

  it('não registra nada quando a execução não mudou', () => {
    expect(
      processChanges({
        before: withRun(run),
        after: withRun(run),
        at: CHANGED_AT,
      }),
    ).toEqual([]);
  });

  it('registra o início do processo', () => {
    expect(
      processChanges({ before: card, after: withRun(run), at: CHANGED_AT }),
    ).toEqual([{ at: CHANGED_AT, kind: 'process-started', name: 'Processo' }]);
  });

  it('registra cada etapa resolvida, com o ramo escolhido', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'pick' }),
      branching({ id: 'pick', kind: 'decision', branches: { sim: 'end' } }),
      end({ id: 'end' }),
    ]);
    const started = begin(plan);
    const tokenId = tokenAt({ run: started, stepRef: 'pick' }).id;
    const chosen = act({
      plan,
      run: started,
      action: { kind: 'choose', tokenId, exitIds: ['sim'] },
    });
    const changes = processChanges({
      before: withRun(started),
      after: withRun(chosen),
      at: CHANGED_AT,
    });
    expect(changes[0]).toEqual({
      at: CHANGED_AT,
      kind: 'process-step',
      step: 'pick',
      detail: 'sim',
    });
    expect(changes[1]).toMatchObject({ kind: 'process-finished' });
  });

  it('registra a conclusão do processo com o desfecho', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'a' }),
      step({ id: 'a', to: 'end' }),
      end({ id: 'end', outcome: { kind: 'completed', label: 'Entregue' } }),
    ]);
    const started = begin(plan);
    const finished = completeAt({ plan, run: started, stepRef: 'a' });
    expect(
      processChanges({
        before: withRun(started),
        after: withRun(finished),
        at: CHANGED_AT,
      }),
    ).toEqual([
      { at: CHANGED_AT, kind: 'process-step', step: 'a', detail: undefined },
      {
        at: CHANGED_AT,
        kind: 'process-finished',
        name: 'Processo',
        outcome: 'Entregue',
      },
    ]);
  });

  it('registra o cancelamento e ignora a delegação', () => {
    const tokenId = tokenAt({ run, stepRef: 'a' }).id;
    const delegated = act({
      plan: linearPlan,
      run,
      action: { kind: 'delegate', tokenId, delegateId: 'child' },
    });
    expect(
      processChanges({
        before: withRun(run),
        after: withRun(delegated),
        at: CHANGED_AT,
      }),
    ).toEqual([]);
    const cancelled = act({
      plan: linearPlan,
      run: delegated,
      action: { kind: 'cancel' },
    });
    expect(
      processChanges({
        before: withRun(delegated),
        after: withRun(cancelled),
        at: CHANGED_AT,
      }),
    ).toEqual([
      { at: CHANGED_AT, kind: 'process-cancelled', name: 'Processo' },
    ]);
  });

  it('registra a remoção do processo do card', () => {
    expect(
      processChanges({ before: withRun(run), after: card, at: CHANGED_AT }),
    ).toEqual([{ at: CHANGED_AT, kind: 'process-removed', name: 'Processo' }]);
  });

  it('registra as etapas da execução nova que andou sozinha', () => {
    const plan = planOf([
      step({ id: 'start', kind: 'start', to: 'end' }),
      end({ id: 'end' }),
    ]);
    const changes = processChanges({
      before: card,
      after: withRun(begin(plan)),
      at: CHANGED_AT,
    });
    expect(changes.map((entry) => entry.kind)).toEqual([
      'process-started',
      'process-finished',
    ]);
  });
});

describe('registro do processo no histórico', () => {
  it('nunca se junta ao registro anterior do mesmo tipo', () => {
    const entry: CardActivity = {
      at: CHANGED_AT,
      kind: 'process-step',
      step: 'a',
    };
    expect(isProcessActivity(entry)).toBe(true);
    expect(
      isProcessActivity({ at: CHANGED_AT, kind: 'created', lane: 'A' }),
    ).toBe(false);
    expect(
      appendActivity({ list: [entry], entries: [entry], merge: true }),
    ).toHaveLength(2);
  });

  it('tem texto para cada registro', () => {
    const texts = [
      { at: CHANGED_AT, kind: 'process-started', name: 'Revisão' },
      { at: CHANGED_AT, kind: 'process-step', step: 'Analisar' },
      { at: CHANGED_AT, kind: 'process-step', step: 'Decidir', detail: 'Sim' },
      { at: CHANGED_AT, kind: 'process-finished', name: 'Revisão' },
      {
        at: CHANGED_AT,
        kind: 'process-finished',
        name: 'Revisão',
        outcome: 'Entregue',
      },
      { at: CHANGED_AT, kind: 'process-cancelled', name: 'Revisão' },
      { at: CHANGED_AT, kind: 'process-removed', name: 'Revisão' },
    ] satisfies CardActivity[];
    expect(texts.map(activityText)).toEqual([
      'Processo Revisão iniciado.',
      'Etapa Analisar resolvida.',
      'Etapa Decidir resolvida: Sim.',
      'Processo Revisão concluído.',
      'Processo Revisão concluído: Entregue.',
      'Processo Revisão cancelado.',
      'Processo Revisão removido do card.',
    ]);
  });
});
