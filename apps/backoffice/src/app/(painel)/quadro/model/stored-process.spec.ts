import { linearPlan } from '@/shared/process/engine-test-plans';

import { boardProcess, runningCard, runOf } from './process-test-data';
import { processCardData, toProcesses, toRules } from './stored-process';

describe('toRules', () => {
  it('lê só as regras ligadas e conhecidas', () => {
    expect(
      toRules({
        doneWaitsProcess: true,
        parentWaitsChildren: false,
        childInherits: 'sim',
        unknown: true,
      }),
    ).toEqual({ doneWaitsProcess: true });
  });

  it('vale como nenhuma regra quando o gravado não é objeto ou não liga nada', () => {
    expect(toRules(undefined)).toBeUndefined();
    expect(toRules(['doneWaitsProcess'])).toBeUndefined();
    expect(toRules({ doneWaitsProcess: false })).toBeUndefined();
  });
});

describe('processCardData', () => {
  it('lê a execução, os bloqueadores sem repetição e a etapa que o card executa', () => {
    const run = runOf(runningCard({ id: 'a' }));
    const stored = JSON.parse(
      JSON.stringify({
        process: run,
        blockedBy: ['b', 'c', 'b', '', 7],
        stepOf: { cardId: 'owner', tokenId: 'token-1' },
      }),
    );
    expect(processCardData(stored)).toEqual({
      process: run,
      blockedBy: ['b', 'c'],
      stepOf: { cardId: 'owner', tokenId: 'token-1' },
    });
  });

  it('descarta o que está fora do formato sem invalidar o card', () => {
    expect(
      processCardData({
        process: { definitionId: '' },
        blockedBy: 'b',
        stepOf: { cardId: 'owner' },
      }),
    ).toEqual({
      process: undefined,
      blockedBy: undefined,
      stepOf: undefined,
    });
    expect(processCardData({ stepOf: 'owner' }).stepOf).toBeUndefined();
  });

  it('volta sem nada no card gravado antes do processo existir', () => {
    expect(processCardData({ id: 'a', title: 'A' })).toEqual({
      process: undefined,
      blockedBy: undefined,
      stepOf: undefined,
    });
  });
});

describe('toProcesses', () => {
  const process = boardProcess();

  it('lê os roteiros e fica com o primeiro de cada versão', () => {
    const stored = JSON.parse(
      JSON.stringify([process, { ...process, name: 'Repetido' }]),
    );
    expect(toProcesses(stored)).toEqual([process]);
  });

  it('descarta o roteiro fora do formato', () => {
    const plan = JSON.parse(JSON.stringify(linearPlan));
    expect(
      toProcesses([
        'roteiro',
        { ...process, definitionId: '' },
        { ...process, version: 0 },
        { ...process, name: 3 },
        { ...process, plan: { startId: 'x', steps: [] } },
        { ...process, version: 2, plan },
      ]),
    ).toEqual([{ ...process, version: 2, plan }]);
  });

  it('volta sem roteiros quando não há lista', () => {
    expect(toProcesses(undefined)).toBeUndefined();
    expect(toProcesses([])).toBeUndefined();
  });
});
