/** Quantos passos o desfazer guarda; os mais antigos saem primeiro. */
export const HISTORY_LIMIT = 100;

/** Pilha de desfazer e refazer em volta do estado atual. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** Chave do último registro; o próximo com a mesma chave entra no mesmo passo. */
  readonly lastKey?: string;
}

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export interface IsCoalescingParams<T> {
  readonly history: History<T>;
  readonly key?: string;
}

/** O registro seguinte com a mesma chave do anterior entra no mesmo passo do desfazer. */
export function isCoalescing<T>(params: IsCoalescingParams<T>): boolean {
  return params.key !== undefined && params.key === params.history.lastKey;
}

export interface RecordChangeParams<T> {
  readonly history: History<T>;
  readonly next: T;
  readonly key?: string;
}

/**
 * Registra um novo estado. Com a mesma chave do registro anterior, substitui o estado atual sem criar passo (digitação
 * seguida, movimento pelo teclado). Qualquer registro apaga o que havia para refazer.
 */
export function recordChange<T>(params: RecordChangeParams<T>): History<T> {
  const { history, next, key } = params;
  if (next === history.present) {
    return history;
  }
  if (isCoalescing({ history, key })) {
    return { ...history, present: next, future: [] };
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
  };
}

/** Desfaz o passo em andamento por inteiro, como se ele nunca tivesse começado (o Esc de um movimento). */
export function dropCoalesced<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: history.future,
  };
}

/** Fecha o passo atual: o próximo registro vira um passo novo, mesmo com a mesma chave. */
export function sealHistory<T>(history: History<T>): History<T> {
  return history.lastKey === undefined
    ? history
    : { ...history, lastKey: undefined };
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
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}
