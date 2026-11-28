import { useEffect, useState } from 'react';

import { readStorage, writeStorage } from './browser-storage';

/** Visões do quadro: as colunas, a lista de cards e a tabela das etapas pendentes dos processos. */
export type BoardViewMode = 'board' | 'list' | 'steps';

const VIEW_MODES: readonly BoardViewMode[] = ['board', 'list', 'steps'];

export interface BoardView {
  readonly mode: BoardViewMode;
  /** No quadro, os cards ficam em linhas, uma por card pai. */
  readonly grouped: boolean;
  /** Na lista, cada card fica abaixo do pai, com recuo por nível. */
  readonly tree: boolean;
  /** Ids dos cards com os filhos recolhidos na lista em árvore. */
  readonly collapsedRows: readonly string[];
}

const DEFAULT_VIEW: BoardView = {
  mode: 'board',
  grouped: false,
  tree: false,
  collapsedRows: [],
};

export function boardViewKey(storageKey: string): string {
  return `${storageKey}:visao`;
}

function parseMode(value: unknown): BoardViewMode {
  return VIEW_MODES.find((mode) => mode === value) ?? DEFAULT_VIEW.mode;
}

function parseIds(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : [];
}

function parseView(raw: string | null): BoardView {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) {
      return DEFAULT_VIEW;
    }
    const record = data as Record<string, unknown>;
    return {
      mode: parseMode(record.mode),
      grouped: record.grouped === true,
      tree: record.tree === true,
      collapsedRows: parseIds(record.collapsedRows),
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

export interface UseBoardViewResult {
  readonly view: BoardView;
  readonly setView: (change: Partial<BoardView>) => void;
}

/** Visão do quadro, uma preferência de tela como as colunas recolhidas: fica gravada à parte e não entra no desfazer. */
export function useBoardView(storageKey?: string): UseBoardViewResult {
  const key = storageKey ? boardViewKey(storageKey) : undefined;
  const [view, setViewState] = useState(DEFAULT_VIEW);
  const [loaded, setLoaded] = useState(!key);

  useEffect(() => {
    if (!key) {
      return;
    }
    setViewState(parseView(readStorage(key)));
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (key && loaded) {
      writeStorage({ key, value: JSON.stringify(view) });
    }
  }, [key, loaded, view]);

  return {
    view,
    setView: (change) => setViewState((current) => ({ ...current, ...change })),
  };
}
