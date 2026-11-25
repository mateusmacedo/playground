/** Desfazer e refazer por instantâneos: o passado, o estado atual e o futuro desfeito. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** Chave do último passo gravado, para juntar edições seguidas do mesmo campo num passo só. */
  readonly lastKey?: string;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

function trimmed<T>(past: readonly T[]): readonly T[] {
  return past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past;
}

export interface CommitParams<T> {
  readonly history: History<T>;
  readonly next: T;
  readonly key?: string;
}

/**
 * Grava um passo: o estado atual vai para o passado e `next` vira o atual. Com a mesma `key` do passo anterior, só
 * troca o atual, sem passo novo. Um passo novo apaga o futuro desfeito.
 */
export function commit<T>(params: CommitParams<T>): History<T> {
  const { history, next, key } = params;
  if (next === history.present) {
    return history;
  }
  if (key !== undefined && key === history.lastKey) {
    return { ...history, present: next, future: [] };
  }
  return {
    past: trimmed([...history.past, history.present]),
    present: next,
    future: [],
    lastKey: key,
  };
}

export interface ReplacePresentParams<T> {
  readonly history: History<T>;
  readonly next: T;
}

/** Troca o estado atual sem gravar passo: seleção, medidas e posições no meio de um arraste. */
export function replacePresent<T>(params: ReplacePresentParams<T>): History<T> {
  const { history, next } = params;
  return next === history.present ? history : { ...history, present: next };
}

export interface CommitSinceParams<T> {
  readonly history: History<T>;
  readonly before: T;
}

/** Grava como um passo o que mudou desde `before`, como o fim de um arraste, mantendo o estado atual. */
export function commitSince<T>(params: CommitSinceParams<T>): History<T> {
  const { history, before } = params;
  if (before === history.present) {
    return history;
  }
  return {
    past: trimmed([...history.past, before]),
    present: history.present,
    future: [],
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return {
    past: trimmed([...history.past, history.present]),
    present: next,
    future: rest,
  };
}
