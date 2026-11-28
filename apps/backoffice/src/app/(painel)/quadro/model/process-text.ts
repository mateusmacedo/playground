import { eventName, exitName } from '@/shared/process/engine-kinds';
import type { PlanEvent, PlanExit } from '@/shared/process/plan';
import type { RunEvent, RunStatus } from '@/shared/process/run';

const STATUS_TEXT: Readonly<Record<RunStatus, string>> = {
  running: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

/** Situação da execução, em uma ou duas palavras. */
export function runStatusText(status: RunStatus): string {
  return STATUS_TEXT[status];
}

/** Nome da etapa para as frases da tela; a etapa sem nome é chamada assim. */
export function stepName(label: string): string {
  return label.trim() || 'sem nome';
}

/** O que o botão da saída diz: o verbo da aprovação, o desfecho da espera ou o caminho a seguir. */
export function choiceText(exit: PlanExit): string {
  switch (exit.meaning) {
    case 'approved':
      return 'Aprovar';
    case 'rejected':
      return 'Rejeitar';
    case 'received':
    case 'expired':
      return exitName(exit);
    case 'next':
      return 'Seguir';
    case 'branch':
      return `Seguir por ${exitName(exit)}`;
  }
}

/** O que o botão da exceção diz, com o efeito dela sobre a etapa. */
export function raiseText(event: PlanEvent): string {
  const effect = event.interrupting ? 'interrompe a etapa' : 'a etapa continua';
  return `Registrar exceção: ${eventName(event)} (${effect})`;
}

interface SentenceParams {
  readonly text: string;
  /** O que o motor registrou junto: o ramo, o desfecho ou a observação dele. */
  readonly detail: string | undefined;
}

function sentence(params: SentenceParams): string {
  const { text, detail } = params;
  return detail ? `${text}: ${detail}.` : `${text}.`;
}

/** A entrada da trilha da execução em uma frase. */
export function runEventText(event: RunEvent): string {
  const { detail } = event;
  const name = stepName(event.label);
  switch (event.kind) {
    case 'started':
      return `Processo ${name} iniciado.`;
    case 'step':
      return sentence({ text: `Etapa ${name} concluída`, detail });
    case 'choice':
      return sentence({ text: `Etapa ${name}, caminho escolhido`, detail });
    case 'approval':
      return sentence({ text: `Aprovação ${name}`, detail });
    case 'event':
      return sentence({ text: `Exceção na etapa ${name}`, detail });
    case 'path-ended':
      return sentence({ text: `Caminho encerrado em ${name}`, detail });
    case 'finished':
      return sentence({ text: 'Fim do processo', detail });
    case 'cancelled':
      // NOTE: o motor registra aqui as etapas que ficaram pendentes, já como uma frase própria.
      return detail ? `Processo cancelado. ${detail}.` : 'Processo cancelado.';
    case 'delegated':
      return `Etapa ${name} entregue a um card filho.`;
  }
}
