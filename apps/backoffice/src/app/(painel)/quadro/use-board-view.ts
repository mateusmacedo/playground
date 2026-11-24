import { useEffect, useState } from 'react';

import { readStorage, writeStorage } from './browser-storage';

export type BoardViewMode = 'board' | 'list';

export interface BoardView {
  readonly mode: BoardViewMode;
  /** No quadro, os cards ficam em linhas, uma por card pai. */
  readonly grouped: boolean;
}

const DEFAULT_VIEW: BoardView = { mode: 'board', grouped: false };

export function boardViewKey(storageKey: string): string {
  return `${storageKey}:visao`;
}

function parseView(raw: string | null): BoardView {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) {
      return DEFAULT_VIEW;
    }
    const record = data as Record<string, unknown>;
    return {
      mode: record.mode === 'list' ? 'list' : 'board',
      grouped: record.grouped === true,
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
