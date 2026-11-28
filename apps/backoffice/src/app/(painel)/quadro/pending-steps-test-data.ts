import { begin, end, planOf, step } from '@/shared/process/engine-test-kit';
import { linearPlan, nestedPlan } from '@/shared/process/engine-test-plans';
import type { ProcessPlan } from '@/shared/process/plan';
import type { ProcessRun } from '@/shared/process/run';

import type { Board, BoardProcess } from './model/board';
import { processBoard } from './model/process-test-data';

/** Instante da consulta nos testes das etapas: duas horas depois do início das execuções de teste. */
export const STEPS_NOW = '2026-11-26T12:00:00.000Z';

interface Flow {
  readonly process: BoardProcess;
  readonly run: ProcessRun;
}

interface FlowParams {
  readonly id: string;
  readonly plan: ProcessPlan;
}

function flow(params: FlowParams): Flow {
  const { id, plan } = params;
  return {
    process: { definitionId: id, version: 1, name: `Processo ${id}`, plan },
    run: { ...begin(plan), definitionId: id },
  };
}

interface DuePlanParams {
  readonly label: string;
  readonly role: string;
  readonly amount: number;
  readonly unit: 'hours' | 'days';
}

/** Roteiro de uma tarefa humana com papel e prazo. */
function duePlan(params: DuePlanParams): ProcessPlan {
  const { label, role, amount, unit } = params;
  return planOf([
    step({ id: 'start', kind: 'start', to: 'work' }),
    step({
      id: 'work',
      kind: 'human-task',
      to: 'end',
      data: { label, role, dueIn: { amount, unit } },
    }),
    end({ id: 'end' }),
  ]);
}

/**
 * Quadro com quatro processos em andamento, um por card, na ordem em que a visão "Etapas" os mostra em `STEPS_NOW`:
 * Contrato (Analisar, da Analista, atrasada e com responsável), Proposta (Revisar, do Revisor, no prazo), Cadastro
 * (etapa sem papel nem prazo) e Auditoria (etapa de dentro de um subprocesso).
 */
export function stepsBoard(): Board {
  const urgent = flow({
    id: 'urgent',
    plan: duePlan({
      label: 'Analisar',
      role: 'Analista',
      amount: 1,
      unit: 'hours',
    }),
  });
  const later = flow({
    id: 'later',
    plan: duePlan({
      label: 'Revisar',
      role: 'Revisor',
      amount: 2,
      unit: 'days',
    }),
  });
  const plain = flow({ id: 'plain', plan: linearPlan });
  const nested = flow({ id: 'nested', plan: nestedPlan });
  const board = processBoard({
    todo: [
      { id: 'proposta', title: 'Proposta', process: later.run },
      { id: 'cadastro', title: 'Cadastro', process: plain.run },
      { id: 'auditoria', title: 'Auditoria', process: nested.run },
      { id: 'livre', title: 'Sem processo' },
    ],
    doing: [
      {
        id: 'contrato',
        title: 'Contrato',
        assigneeId: 'ana',
        process: urgent.run,
      },
    ],
    processes: [urgent.process, later.process, plain.process, nested.process],
  });
  return {
    ...board,
    config: { ...board.config, people: [{ id: 'ana', name: 'Ana' }] },
  };
}
