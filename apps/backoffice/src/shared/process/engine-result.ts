import type { ProcessRun } from './run';

/** Motivo da recusa, para quem chama decidir o que fazer; a mensagem é o texto para a pessoa. */
export type RefusalCode =
  | 'invalid-plan'
  | 'not-running'
  | 'unknown-token'
  | 'unknown-step'
  | 'not-actionable'
  | 'wrong-action'
  | 'exit-count'
  | 'invalid-exit'
  | 'note-required'
  | 'missing-fields'
  | 'invalid-fields'
  | 'unknown-event'
  | 'already-delegated'
  | 'delegate-required'
  | 'endless-loop';

export interface Refusal {
  readonly code: RefusalCode;
  /** Texto em PT-BR, pronto para a tela. */
  readonly message: string;
}

export interface AcceptedRun {
  readonly ok: true;
  readonly run: ProcessRun;
}

export interface RefusedRun {
  readonly ok: false;
  readonly refusal: Refusal;
}

/** Resultado de iniciar ou avançar uma execução: a execução nova ou a recusa, nunca uma exceção. */
export type RunResult = AcceptedRun | RefusedRun;

export function accepted(run: ProcessRun): AcceptedRun {
  return { ok: true, run };
}

export function refused(refusal: Refusal): RefusedRun {
  return { ok: false, refusal };
}

export const INVALID_PLAN: Refusal = {
  code: 'invalid-plan',
  message: 'O processo não tem um Início válido.',
};

export const NOT_RUNNING: Refusal = {
  code: 'not-running',
  message: 'O processo não está em andamento.',
};

export const UNKNOWN_TOKEN: Refusal = {
  code: 'unknown-token',
  message: 'Esta etapa não está mais ativa.',
};

export const UNKNOWN_STEP: Refusal = {
  code: 'unknown-step',
  message: 'Esta etapa não existe no roteiro do processo.',
};

export const NOT_ACTIONABLE: Refusal = {
  code: 'not-actionable',
  message: 'Esta etapa não espera uma ação agora.',
};

export const CHOICE_EXPECTED: Refusal = {
  code: 'wrong-action',
  message: 'Esta etapa pede a escolha de um caminho.',
};

export const NOTHING_TO_CHOOSE: Refusal = {
  code: 'wrong-action',
  message: 'Esta etapa não tem caminhos para escolher.',
};

export const ONE_EXIT_ONLY: Refusal = {
  code: 'exit-count',
  message: 'Escolha um único caminho.',
};

export const SOME_EXIT_NEEDED: Refusal = {
  code: 'exit-count',
  message: 'Escolha ao menos um caminho.',
};

export const INVALID_EXIT: Refusal = {
  code: 'invalid-exit',
  message: 'Este caminho não existe nesta etapa.',
};

export const NOTE_REQUIRED: Refusal = {
  code: 'note-required',
  message: 'Informe o motivo da rejeição.',
};

export const UNKNOWN_EVENT: Refusal = {
  code: 'unknown-event',
  message: 'Esta exceção não existe nesta etapa.',
};

export const ALREADY_DELEGATED: Refusal = {
  code: 'already-delegated',
  message: 'Esta etapa já está delegada.',
};

export const DELEGATE_REQUIRED: Refusal = {
  code: 'delegate-required',
  message: 'Informe quem vai executar a etapa.',
};

export const ENDLESS_LOOP: Refusal = {
  code: 'endless-loop',
  message: 'O processo entrou num laço sem nenhuma etapa que espere uma ação.',
};
