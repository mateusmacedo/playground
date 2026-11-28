import type { StepKind } from '@/shared/process/plan';

const KIND_TEXT: Readonly<Record<StepKind, string>> = {
  start: 'Início',
  task: 'Etapa',
  'human-task': 'Tarefa humana',
  'automated-task': 'Tarefa automatizada',
  'send-message': 'Enviar mensagem',
  'wait-event': 'Aguardar evento',
  timer: 'Temporizador',
  decision: 'Decisão exclusiva',
  merge: 'Convergência de alternativas',
  'inclusive-split': 'Decisão inclusiva',
  'inclusive-join': 'Junção inclusiva',
  'parallel-split': 'Abertura paralela',
  'parallel-join': 'Sincronização paralela',
  approval: 'Aprovação',
  subprocess: 'Subprocesso',
  end: 'Fim',
};

/** Nome do tipo da etapa na tela, igual ao do bloco no editor de processos. */
export function stepKindText(kind: StepKind): string {
  return KIND_TEXT[kind];
}
