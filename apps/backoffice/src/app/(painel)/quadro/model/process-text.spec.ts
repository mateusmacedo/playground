import { exception } from '@/shared/process/engine-test-kit';
import type { PlanExit } from '@/shared/process/plan';
import type { RunEvent, RunEventKind } from '@/shared/process/run';

import {
  choiceText,
  raiseText,
  runEventText,
  runStatusText,
  stepName,
} from './process-text';

const AT = '2026-11-26T12:00:00.000Z';

interface EventParams {
  readonly kind: RunEventKind;
  readonly label?: string;
  readonly detail?: string;
}

function eventOf(params: EventParams): RunEvent {
  const { kind, label = 'Revisar', detail } = params;
  return { at: AT, kind, label, detail };
}

describe('runStatusText', () => {
  it('diz a situação da execução', () => {
    expect(runStatusText('running')).toBe('Em andamento');
    expect(runStatusText('completed')).toBe('Concluído');
    expect(runStatusText('cancelled')).toBe('Cancelado');
  });
});

describe('stepName', () => {
  it('usa o nome da etapa sem os espaços das pontas', () => {
    expect(stepName('  Revisar ')).toBe('Revisar');
  });

  it('chama de "sem nome" a etapa que não tem nome', () => {
    expect(stepName('   ')).toBe('sem nome');
  });
});

describe('choiceText', () => {
  function exit(change: Partial<PlanExit>): PlanExit {
    return { id: 'out', meaning: 'branch', ...change };
  }

  it('usa o verbo da decisão na aprovação', () => {
    expect(choiceText(exit({ meaning: 'approved' }))).toBe('Aprovar');
    expect(choiceText(exit({ meaning: 'rejected' }))).toBe('Rejeitar');
  });

  it('diz o que aconteceu na espera por evento', () => {
    expect(choiceText(exit({ meaning: 'received' }))).toBe('Evento recebido');
    expect(choiceText(exit({ meaning: 'expired' }))).toBe('Prazo expirado');
  });

  it('nomeia o caminho a seguir nos ramos, com o rótulo do ramo', () => {
    expect(choiceText(exit({ label: 'Urgente' }))).toBe('Seguir por Urgente');
    expect(choiceText(exit({}))).toBe('Seguir por Ramo');
    expect(choiceText(exit({ meaning: 'next' }))).toBe('Seguir');
  });
});

describe('raiseText', () => {
  it('diz se a exceção interrompe a etapa', () => {
    expect(raiseText(exception({ id: 'Falha' }))).toBe(
      'Registrar exceção: Falha (interrompe a etapa)',
    );
    expect(raiseText(exception({ id: 'Aviso', interrupting: false }))).toBe(
      'Registrar exceção: Aviso (a etapa continua)',
    );
  });
});

describe('runEventText', () => {
  it('conta o início e a delegação com o nome do que aconteceu', () => {
    expect(runEventText(eventOf({ kind: 'started', label: 'Compra' }))).toBe(
      'Processo Compra iniciado.',
    );
    expect(runEventText(eventOf({ kind: 'delegated' }))).toBe(
      'Etapa Revisar entregue a um card filho.',
    );
  });

  it('acrescenta o que o motor registrou junto da etapa resolvida', () => {
    expect(runEventText(eventOf({ kind: 'step' }))).toBe(
      'Etapa Revisar concluída.',
    );
    expect(
      runEventText(eventOf({ kind: 'step', detail: 'antes do previsto' })),
    ).toBe('Etapa Revisar concluída: antes do previsto.');
    expect(runEventText(eventOf({ kind: 'choice', detail: 'Urgente' }))).toBe(
      'Etapa Revisar, caminho escolhido: Urgente.',
    );
    expect(
      runEventText(eventOf({ kind: 'approval', detail: 'Rejeitado' })),
    ).toBe('Aprovação Revisar: Rejeitado.');
    expect(runEventText(eventOf({ kind: 'event', detail: 'Falha' }))).toBe(
      'Exceção na etapa Revisar: Falha.',
    );
  });

  it('conta o fim de um caminho e o do processo com o desfecho', () => {
    expect(
      runEventText(
        eventOf({ kind: 'path-ended', label: 'Fim', detail: 'Concluído' }),
      ),
    ).toBe('Caminho encerrado em Fim: Concluído.');
    expect(
      runEventText(eventOf({ kind: 'finished', detail: 'Concluído' })),
    ).toBe('Fim do processo: Concluído.');
  });

  it('conta o cancelamento com as etapas que ficaram pendentes, quando há', () => {
    expect(runEventText(eventOf({ kind: 'cancelled' }))).toBe(
      'Processo cancelado.',
    );
    expect(
      runEventText(
        eventOf({ kind: 'cancelled', detail: 'Etapas pendentes: a, b' }),
      ),
    ).toBe('Processo cancelado. Etapas pendentes: a, b.');
  });

  it('chama de "sem nome" a etapa sem nome', () => {
    expect(runEventText(eventOf({ kind: 'step', label: '' }))).toBe(
      'Etapa sem nome concluída.',
    );
  });
});
